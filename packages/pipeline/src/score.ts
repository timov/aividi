import {
  and,
  count,
  db,
  entity,
  entityAttribute,
  entityCategory,
  entityService,
  eq,
  isNotNull,
  media,
  openingHours,
  raw,
  review,
  scoreRun,
} from '@aividi/db'
import { computeKarma, computeScore } from '@aividi/core'

/**
 * Recompute the AIVIDI Score for one entity and record the run.
 *
 * Every run is stored with its components, because a ranking you cannot
 * explain to the business you are ranking is a ranking you cannot defend.
 * Note what is absent from the inputs: anything about money. Paid placement
 * is a labelled slot above the list, never a nudge inside it.
 */
export async function score(entityId: string): Promise<number> {
  const [row] = await db.select().from(entity).where(eq(entity.id, entityId)).limit(1)
  if (!row) throw new Error(`entity ${entityId} not found`)

  const [categories] = await db
    .select({ n: count() })
    .from(entityCategory)
    .where(eq(entityCategory.entityId, entityId))

  const [attributes] = await db
    .select({ n: count() })
    .from(entityAttribute)
    .where(eq(entityAttribute.entityId, entityId))

  const [photos] = await db
    .select({ n: count() })
    .from(media)
    .where(and(eq(media.entityId, entityId), eq(media.kind, 'photo')))

  const [pricedServices] = await db
    .select({ n: count() })
    .from(entityService)
    .where(and(eq(entityService.entityId, entityId), isNotNull(entityService.priceFrom)))

  const [hours] = await db
    .select({ n: raw<number>`count(distinct ${openingHours.weekday})::int` })
    .from(openingHours)
    .where(eq(openingHours.entityId, entityId))

  const [reviews] = await db
    .select({
      n: count(),
      avg: raw<number | null>`avg(${review.rating})::float`,
    })
    .from(review)
    .where(and(eq(review.entityId, entityId), eq(review.published, true)))

  const result = computeScore({
    hasPhone: Boolean(row.phoneE164),
    hasAddress: Boolean(row.address),
    hasCoordinates: row.lat != null && row.lng != null,
    hasWebsiteOrSocial: Boolean(row.website || row.facebook || row.instagram),
    hasDescription: Boolean(row.descriptionMk && row.descriptionMk.length > 80),
    categoryCount: categories?.n ?? 0,
    openingHoursDays: hours?.n ?? 0,
    photoCount: photos?.n ?? 0,
    pricedServiceCount: pricedServices?.n ?? 0,
    attributeCount: attributes?.n ?? 0,
    reviewCount: reviews?.n ?? 0,
    averageRating: reviews?.avg ?? null,
    verifiedAt: row.verifiedAt,
    claimed: Boolean(row.claimedBy),
  })

  await db.insert(scoreRun).values({
    entityId,
    total: result.total,
    components: result.components,
  })

  // Карма is computed in the same pass but kept in its own columns: one
  // number for the record, one for the reputation, never blended.
  const karma = computeKarma({
    externalRating: row.ratingExternal,
    externalCount: row.reviewCountExternal,
    ownRating: reviews?.avg ?? null,
    ownCount: reviews?.n ?? 0,
    hasSummary: Boolean(row.summaryMk && row.summaryMk.length > 40),
  })

  await db
    .update(entity)
    .set({
      score: result.total,
      scoreComputedAt: new Date(),
      karma: karma.total,
      karmaReviews: karma.reviews,
      karmaConfidence: karma.confidence,
      karmaComponents: karma.components,
    })
    .where(eq(entity.id, entityId))

  return result.total
}
