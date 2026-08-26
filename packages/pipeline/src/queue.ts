import { Queue, type JobsOptions } from 'bullmq'
import IORedis from 'ioredis'

export const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

export interface JobMap {
  /** Pull records from a configured source into source_record. */
  ingest: { sourceId: string; limit?: number }
  /** Turn one raw record into / onto an entity, with matching. */
  promote: { sourceRecordId: string }
  /** Recompute entity columns from entity_field provenance. */
  materialize: { entityId: string }
  /** Recompute the AIVIDI score. */
  score: { entityId: string }
}

export type JobName = keyof JobMap

const defaults: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 2000 },
}

export const pipeline = new Queue('pipeline', { connection, defaultJobOptions: defaults })

export function enqueue<N extends JobName>(
  name: N,
  data: JobMap[N],
  opts?: JobsOptions,
): Promise<unknown> {
  return pipeline.add(name, data, opts)
}

/** Deduplicating enqueue - the same entity queued twice collapses to one job. */
export function enqueueOnce<N extends JobName>(
  name: N,
  data: JobMap[N],
  key: string,
): Promise<unknown> {
  return pipeline.add(name, data, { ...defaults, jobId: `${name}:${key}` })
}
