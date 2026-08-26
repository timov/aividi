import { Worker } from 'bullmq'
import { ingest, materializeEntity, promote, score } from '@aividi/pipeline'
import { connection, enqueue, enqueueOnce, type JobMap } from '@aividi/pipeline/queue'

/**
 * One worker, one queue, four job types. Ingestion fans out into promotion,
 * promotion fans out into scoring; nothing else needs coordinating yet.
 */
const worker = new Worker(
  'pipeline',
  async (job) => {
    switch (job.name as keyof JobMap) {
      case 'ingest': {
        const { sourceId, limit } = job.data as JobMap['ingest']
        const result = await ingest(sourceId, limit)
        for (const sourceRecordId of result.newRecordIds) {
          await enqueue('promote', { sourceRecordId })
        }
        return { fetched: result.fetched, inserted: result.inserted, unchanged: result.unchanged }
      }

      case 'promote': {
        const { sourceRecordId } = job.data as JobMap['promote']
        const result = await promote(sourceRecordId)
        if (result.entityId) {
          await enqueueOnce('score', { entityId: result.entityId }, result.entityId)
        }
        return result
      }

      case 'materialize': {
        const { entityId } = job.data as JobMap['materialize']
        await materializeEntity(entityId)
        await enqueueOnce('score', { entityId }, entityId)
        return { entityId }
      }

      case 'score': {
        const { entityId } = job.data as JobMap['score']
        return { entityId, total: await score(entityId) }
      }

      default:
        throw new Error(`unknown job ${job.name}`)
    }
  },
  {
    connection,
    // Overpass and Places both rate-limit, and matching is write-heavy.
    // Five at a time is plenty for a pilot city.
    concurrency: 5,
  },
)

worker.on('completed', (job, result) => {
  console.log(`[ok] ${job.name}`, JSON.stringify(result))
})

worker.on('failed', (job, err) => {
  console.error(`[fail] ${job?.name}: ${err.message}`)
})

console.log('worker up, waiting for jobs on "pipeline"')

async function shutdown(signal: string) {
  console.log(`\n${signal} - closing worker`)
  await worker.close()
  await connection.quit()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
