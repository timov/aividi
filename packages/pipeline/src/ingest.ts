import { createHash } from 'node:crypto'
import { db, eq, jobRun, source, sourceRecord } from '@aividi/db'
import { adapterFor } from './sources/index.js'

export interface IngestResult {
  fetched: number
  inserted: number
  unchanged: number
  /**
   * Records that are new or changed. The caller decides what to do with them -
   * the worker queues a promote job each, the CLI promotes them inline - which
   * keeps this package free of any dependency on Redis.
   */
  newRecordIds: string[]
}

/**
 * Pull records from a source into source_record and queue each new or changed
 * one for promotion. Raw payloads are immutable: an unchanged record is
 * skipped by content hash rather than rewritten, so `fetched_at` keeps meaning
 * "when this version first appeared".
 */
export async function ingest(sourceId: string, limit?: number): Promise<IngestResult> {
  const [src] = await db.select().from(source).where(eq(source.id, sourceId)).limit(1)
  if (!src) throw new Error(`source ${sourceId} not found`)

  const [run] = await db
    .insert(jobRun)
    .values({ kind: `ingest:${src.kind}`, status: 'running' })
    .returning({ id: jobRun.id })

  try {
    const adapter = adapterFor(src.kind)
    const records = await adapter.fetch(src.config, limit)

    let unchanged = 0
    const newRecordIds: string[] = []

    for (const record of records) {
      const hash = createHash('sha256').update(JSON.stringify(record.payload)).digest('hex')

      const [existing] = await db
        .select({ id: sourceRecord.id, hash: sourceRecord.hash })
        .from(sourceRecord)
        .where(eq(sourceRecord.externalId, record.externalId))
        .limit(1)

      if (existing?.hash === hash) {
        unchanged++
        continue
      }

      const [row] = await db
        .insert(sourceRecord)
        .values({
          sourceId,
          externalId: record.externalId,
          payload: record.payload,
          hash,
        })
        .onConflictDoUpdate({
          target: [sourceRecord.sourceId, sourceRecord.externalId],
          set: {
            payload: record.payload,
            hash,
            fetchedAt: new Date(),
            processedAt: null,
            error: null,
          },
        })
        .returning({ id: sourceRecord.id })

      if (row) newRecordIds.push(row.id)
    }

    const stats = {
      fetched: records.length,
      inserted: newRecordIds.length,
      unchanged,
      newRecordIds,
    }

    await db.update(source).set({ lastRunAt: new Date() }).where(eq(source.id, sourceId))
    if (run) {
      await db
        .update(jobRun)
        .set({
          status: 'ok',
          stats: { fetched: stats.fetched, inserted: stats.inserted, unchanged },
          finishedAt: new Date(),
        })
        .where(eq(jobRun.id, run.id))
    }

    return stats
  } catch (err) {
    if (run) {
      await db
        .update(jobRun)
        .set({
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
          finishedAt: new Date(),
        })
        .where(eq(jobRun.id, run.id))
    }
    throw err
  }
}
