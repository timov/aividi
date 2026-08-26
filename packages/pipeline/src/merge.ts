import {
  and,
  db,
  entity,
  entityAttribute,
  entityCategory,
  entityField,
  entityService,
  eq,
  matchCandidate,
  media,
  ne,
  openingHours,
  or,
  raw,
  review,
  sourceRecord,
} from '@aividi/db'
import { materializeEntity } from './fields.js'

/**
 * Fold `loserId` into `winnerId`.
 *
 * Nothing is deleted. The loser stays in the table with status='merged' and
 * merged_into pointing at the winner, so a bad merge can be explained and, if
 * it comes to it, reversed - and so any URL or citation that ever pointed at
 * the loser can still be redirected rather than 404'd.
 */
export async function mergeEntities(
  winnerId: string,
  loserId: string,
  decidedBy: string,
): Promise<void> {
  if (winnerId === loserId) throw new Error('cannot merge an entity into itself')

  await db.transaction(async (tx) => {
    // Field candidates carry their own provenance, so they can simply move.
    // A collision on (entity, key, source) means both sides heard the same
    // thing from the same source - keep the winner's row and drop the copy.
    await tx.execute(raw`
      update entity_field as f
         set entity_id = ${winnerId}
       where f.entity_id = ${loserId}
         and not exists (
           select 1 from entity_field w
            where w.entity_id = ${winnerId}
              and w.key = f.key
              and w.source_id = f.source_id
         )
    `)
    await tx.delete(entityField).where(eq(entityField.entityId, loserId))

    await tx.execute(raw`
      update entity_category as c
         set entity_id = ${winnerId}, is_primary = false
       where c.entity_id = ${loserId}
         and not exists (
           select 1 from entity_category w
            where w.entity_id = ${winnerId} and w.category_id = c.category_id
         )
    `)
    await tx.delete(entityCategory).where(eq(entityCategory.entityId, loserId))

    await tx.execute(raw`
      update entity_attribute as a
         set entity_id = ${winnerId}
       where a.entity_id = ${loserId}
         and not exists (
           select 1 from entity_attribute w
            where w.entity_id = ${winnerId} and w.attribute_id = a.attribute_id
         )
    `)
    await tx.delete(entityAttribute).where(eq(entityAttribute.entityId, loserId))

    await tx.execute(raw`
      update entity_service as s
         set entity_id = ${winnerId}
       where s.entity_id = ${loserId}
         and not exists (
           select 1 from entity_service w
            where w.entity_id = ${winnerId} and w.service_id = s.service_id
         )
    `)
    await tx.delete(entityService).where(eq(entityService.entityId, loserId))

    // These have no uniqueness to defend - move them wholesale.
    await tx.update(media).set({ entityId: winnerId }).where(eq(media.entityId, loserId))
    await tx.update(review).set({ entityId: winnerId }).where(eq(review.entityId, loserId))
    await tx
      .update(openingHours)
      .set({ entityId: winnerId })
      .where(eq(openingHours.entityId, loserId))
    await tx
      .update(sourceRecord)
      .set({ entityId: winnerId })
      .where(eq(sourceRecord.entityId, loserId))

    await tx
      .update(entity)
      .set({ status: 'merged', mergedInto: winnerId, slug: null, updatedAt: new Date() })
      .where(eq(entity.id, loserId))

    // Any other pending pair involving the loser is now moot.
    await tx
      .update(matchCandidate)
      .set({ decision: 'merged', decidedBy, decidedAt: new Date() })
      .where(
        and(
          or(eq(matchCandidate.leftEntityId, loserId), eq(matchCandidate.rightEntityId, loserId)),
          eq(matchCandidate.decision, 'pending'),
        ),
      )
  })

  await materializeEntity(winnerId)
}

/** Record that two entities are genuinely different businesses. */
export async function rejectMatch(candidateId: string, decidedBy: string): Promise<void> {
  await db
    .update(matchCandidate)
    .set({ decision: 'rejected', decidedBy, decidedAt: new Date() })
    .where(eq(matchCandidate.id, candidateId))
}

/** Entities the merge UI should never offer as a target. */
export function isMergeable(status: string): boolean {
  return status !== 'merged'
}
