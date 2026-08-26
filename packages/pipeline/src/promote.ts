import {
  and,
  arrayOverlaps,
  attribute,
  category,
  db,
  entity,
  entityAttribute,
  entityCategory,
  entityService,
  eq,
  inArray,
  matchCandidate,
  media,
  ne,
  openingHours,
  or,
  place,
  raw,
  service,
  source,
  sourceRecord,
} from '@aividi/db'
import {
  blockingKeys,
  extractPhones,
  haversine,
  hostOf,
  matchKey,
  normalizeAddress,
  normalizeMkPhone,
  normalizeUrl,
  pairKey,
  scoreMatch,
  toLatin,
  type MatchInput,
} from '@aividi/core'
import { applyFields, materializeEntity, type FieldKey } from './fields.js'
import { adapterFor } from './sources/index.js'
import type { NormalizedRecord } from './sources/types.js'

export type PromoteAction = 'merged' | 'created' | 'queued_for_review' | 'skipped'

export interface PromoteResult {
  action: PromoteAction
  entityId: string | null
  candidates: number
  note?: string
}

/**
 * Turn one raw source record into, or onto, a canonical entity.
 *
 * The two rules that matter live in @aividi/core/match: a name-only match
 * never auto-merges, and a strong identifier (EMBS, phone, website host) is
 * what turns a guess into a merge. Everything in between goes to a human in
 * /admin/matches rather than being decided by a threshold nobody can defend.
 */
export async function promote(sourceRecordId: string): Promise<PromoteResult> {
  const [record] = await db
    .select({
      id: sourceRecord.id,
      payload: sourceRecord.payload,
      sourceId: sourceRecord.sourceId,
      kind: source.kind,
      trust: source.trust,
    })
    .from(sourceRecord)
    .innerJoin(source, eq(source.id, sourceRecord.sourceId))
    .where(eq(sourceRecord.id, sourceRecordId))
    .limit(1)

  if (!record) return { action: 'skipped', entityId: null, candidates: 0, note: 'no record' }

  const adapter = adapterFor(record.kind)
  const normalized = adapter.normalize(record.payload)

  if (!normalized || !normalized.name.trim()) {
    await db
      .update(sourceRecord)
      .set({ processedAt: new Date(), error: 'not normalizable' })
      .where(eq(sourceRecord.id, sourceRecordId))
    return { action: 'skipped', entityId: null, candidates: 0, note: 'not normalizable' }
  }

  const input = await toMatchInput(normalized)
  const candidates = await findCandidates(input)

  let best: { id: string; score: number; verdict: string; reason: string } | null = null
  const reviewable: Array<{ id: string; score: number; features: unknown; reason: string }> = []

  for (const candidate of candidates) {
    const result = scoreMatch(input, {
      nameNorm: candidate.nameNorm,
      embs: candidate.embs,
      phoneE164: candidate.phoneE164,
      phoneAlt: candidate.phoneAlt,
      websiteHost: candidate.websiteHost,
      lat: candidate.lat,
      lng: candidate.lng,
      placeId: candidate.placeId,
      addressNorm: candidate.addressNorm,
    })

    if (result.verdict === 'auto' && (!best || result.score > best.score)) {
      best = { id: candidate.id, score: result.score, verdict: 'auto', reason: result.reason }
    } else if (result.verdict === 'review') {
      reviewable.push({
        id: candidate.id,
        score: result.score,
        features: result.features,
        reason: result.reason,
      })
    }
  }

  // --- merge onto an existing entity ---------------------------------------
  if (best) {
    await attach(best.id, normalized, input, record.sourceId, record.id)
    // Everything else that looked close still needs a decision. Without this,
    // a record that auto-merges onto one entity silently discards every other
    // near-match — which is how a hand-collected row lands on top of its own
    // earlier import while the OSM duplicate of the same business sits
    // untouched two rows down the page.
    await queueReviews(
      best.id,
      reviewable.filter((c) => c.id !== best.id),
    )
    await db
      .update(sourceRecord)
      .set({ processedAt: new Date(), entityId: best.id, error: null })
      .where(eq(sourceRecord.id, sourceRecordId))
    return {
      action: 'merged',
      entityId: best.id,
      candidates: candidates.length,
      note: best.reason,
    }
  }

  // --- otherwise create a draft --------------------------------------------
  const [created] = await db
    .insert(entity)
    .values({
      status: 'draft',
      nameMk: normalized.name,
      nameLat: toLatin(normalized.name),
      nameNorm: input.nameNorm,
      placeId: input.placeId ?? null,
    })
    .returning({ id: entity.id })

  if (!created) throw new Error('failed to create entity')

  await attach(created.id, normalized, input, record.sourceId, record.id)

  await queueReviews(created.id, reviewable)

  await db
    .update(sourceRecord)
    .set({ processedAt: new Date(), entityId: created.id, error: null })
    .where(eq(sourceRecord.id, sourceRecordId))

  return {
    action: reviewable.length > 0 ? 'queued_for_review' : 'created',
    entityId: created.id,
    candidates: candidates.length,
  }
}

/* -------------------------------------------------------------------------
   Helpers
   ------------------------------------------------------------------------- */

/**
 * Anything that looked close but not certain becomes a review task, so the
 * duplicate is visible instead of quietly living in the database forever.
 */
async function queueReviews(
  entityId: string,
  reviewable: Array<{ id: string; score: number; features: unknown }>,
): Promise<void> {
  for (const candidate of reviewable.sort((a, b) => b.score - a.score).slice(0, 5)) {
    if (candidate.id === entityId) continue
    await db
      .insert(matchCandidate)
      .values({
        leftEntityId: entityId,
        rightEntityId: candidate.id,
        pairKey: pairKey(entityId, candidate.id),
        score: candidate.score,
        features: candidate.features as Record<string, number | boolean | null>,
      })
      .onConflictDoNothing({ target: matchCandidate.pairKey })
  }
}

async function toMatchInput(record: NormalizedRecord): Promise<MatchInput> {
  const phones = record.phones.map((p) => normalizeMkPhone(p)).filter(Boolean) as string[]
  const placeId = await resolvePlace(record)

  return {
    nameNorm: matchKey(record.name),
    embs: record.embs ?? null,
    phoneE164: phones[0] ?? null,
    phoneAlt: phones.slice(1),
    websiteHost: hostOf(record.website),
    lat: record.lat ?? null,
    lng: record.lng ?? null,
    placeId,
    addressNorm: normalizeAddress(record.address),
  }
}

let placeCache:
  | Array<{
      id: string
      slug: string
      nameMk: string
      kind: string
      lat: number | null
      lng: number | null
    }>
  | null = null

async function resolvePlace(record: NormalizedRecord): Promise<string | null> {
  if (!placeCache) {
    placeCache = await db
      .select({
        id: place.id,
        slug: place.slug,
        nameMk: place.nameMk,
        kind: place.kind,
        lat: place.lat,
        lng: place.lng,
      })
      .from(place)
  }

  if (record.placeSlug) {
    // Accept either the slug or the Macedonian name: whoever fills in a
    // spreadsheet will write "Битола", not "bitola".
    const wanted = record.placeSlug.trim().toLowerCase()
    const hit = placeCache.find(
      (p) => p.slug === wanted || p.nameMk.toLowerCase() === wanted,
    )
    if (hit) return hit.id
    console.warn(`  unknown place "${record.placeSlug}" — falling back to coordinates`)
  }

  if (record.lat == null || record.lng == null) return null

  // Towns only. A business in a village is listed under the town people
  // actually search for, which is why the radius here is generous.
  let nearest: { id: string; distance: number } | null = null
  for (const p of placeCache) {
    if (p.kind !== 'grad') continue
    if (p.lat == null || p.lng == null) continue
    const distance = haversine(record.lat, record.lng, p.lat, p.lng)
    if (distance < 25000 && (!nearest || distance < nearest.distance)) {
      nearest = { id: p.id, distance }
    }
  }
  return nearest?.id ?? null
}

interface CandidateRow {
  id: string
  nameNorm: string
  embs: string | null
  phoneE164: string | null
  phoneAlt: string[]
  websiteHost: string | null
  lat: number | null
  lng: number | null
  placeId: string | null
  addressNorm: string | null
}

/**
 * Pull a small candidate set out of Postgres before any expensive comparison.
 * Strong identifiers first, then a trigram cut on the folded name - which is
 * what entity_name_norm_trgm_idx exists for.
 */
async function findCandidates(input: MatchInput): Promise<CandidateRow[]> {
  const phones = [input.phoneE164, ...(input.phoneAlt ?? [])].filter(Boolean) as string[]

  const conditions = []
  if (input.embs) conditions.push(eq(entity.embs, input.embs))
  if (phones.length > 0) {
    conditions.push(inArray(entity.phoneE164, phones))
    conditions.push(arrayOverlaps(entity.phoneAlt, phones))
  }
  if (input.websiteHost) conditions.push(eq(entity.websiteHost, input.websiteHost))
  if (input.nameNorm.length >= 3) {
    conditions.push(raw`similarity(${entity.nameNorm}, ${input.nameNorm}) > 0.35`)
  }

  if (conditions.length === 0) return []

  return db
    .select({
      id: entity.id,
      nameNorm: entity.nameNorm,
      embs: entity.embs,
      phoneE164: entity.phoneE164,
      phoneAlt: entity.phoneAlt,
      websiteHost: entity.websiteHost,
      lat: entity.lat,
      lng: entity.lng,
      placeId: entity.placeId,
      addressNorm: entity.addressNorm,
    })
    .from(entity)
    .where(and(ne(entity.status, 'merged'), or(...conditions)))
    .limit(30)
}

/** Write everything one record tells us about an entity, then recompute it. */
async function attach(
  entityId: string,
  record: NormalizedRecord,
  input: MatchInput,
  sourceId: string,
  sourceRecordId: string,
): Promise<void> {
  const phones = record.phones.map((p) => normalizeMkPhone(p)).filter(Boolean) as string[]

  const fields: Partial<Record<FieldKey, string | number | null>> = {
    name_mk: record.name,
    summary_mk: record.summary ?? null,
    legal_name: record.legalName ?? null,
    embs: record.embs ?? null,
    edb: record.edb ?? null,
    address: record.address ?? null,
    lat: record.lat ?? null,
    lng: record.lng ?? null,
    phone_e164: phones[0] ?? null,
    email: record.email ?? null,
    // Sources hand us bare domains ('viapica.mk') as often as full URLs.
    website: normalizeUrl(record.website),
    facebook: record.facebook ?? null,
    instagram: record.instagram ?? null,
    description_mk: record.description ?? null,
  }

  await applyFields({ entityId, sourceId, sourceRecordId, fields })

  // Secondary phones live on the entity directly - they have no single
  // "winner" to resolve, so provenance is tracked at the record level.
  if (phones.length > 1) {
    await db
      .update(entity)
      .set({ phoneAlt: phones.slice(1), addressNorm: input.addressNorm ?? null })
      .where(eq(entity.id, entityId))
  } else if (input.addressNorm) {
    await db.update(entity).set({ addressNorm: input.addressNorm }).where(eq(entity.id, entityId))
  }

  if (input.placeId) {
    await db.update(entity).set({ placeId: input.placeId }).where(eq(entity.id, entityId))
  }

  await linkCategories(entityId, record.categorySlugs)
  await linkAttributes(entityId, record.attributeSlugs, sourceId)
  await replaceHours(entityId, record, sourceId)
  await upsertServices(entityId, record, sourceId)
  await upsertPhotos(entityId, record)

  // An aggregate rating seen elsewhere is a prioritisation signal, not
  // content: it decides who gets called first, and never reaches a page.
  if (record.rating) {
    await db
      .update(entity)
      .set({
        ratingExternal: record.rating.value,
        reviewCountExternal: record.rating.count ?? null,
        ratingSource: record.rating.source,
        ratingCheckedAt: new Date(),
      })
      .where(eq(entity.id, entityId))
  }

  await materializeEntity(entityId)
}

async function linkCategories(entityId: string, slugs: string[]): Promise<void> {
  if (slugs.length === 0) return
  const rows = await db
    .select({ id: category.id })
    .from(category)
    .where(inArray(category.slug, slugs))

  for (const [i, row] of rows.entries()) {
    await db
      .insert(entityCategory)
      .values({ entityId, categoryId: row.id, isPrimary: i === 0 })
      .onConflictDoNothing()
  }
}

async function linkAttributes(
  entityId: string,
  slugs: string[],
  sourceId: string,
): Promise<void> {
  if (slugs.length === 0) return
  const rows = await db
    .select({ id: attribute.id })
    .from(attribute)
    .where(inArray(attribute.slug, slugs))

  for (const row of rows) {
    await db
      .insert(entityAttribute)
      .values({ entityId, attributeId: row.id, value: 'true', sourceId })
      .onConflictDoNothing()
  }
}

/**
 * Services with prices. Looked up by slug within the entity's own categories,
 * so a typo in the CSV is skipped loudly rather than silently attached to the
 * wrong category's service.
 */
async function upsertServices(
  entityId: string,
  record: NormalizedRecord,
  sourceId: string,
): Promise<void> {
  const wanted = record.services ?? []
  if (wanted.length === 0) return

  const rows = await db
    .select({ id: service.id, slug: service.slug })
    .from(service)
    .innerJoin(category, eq(category.id, service.categoryId))
    .where(inArray(category.slug, record.categorySlugs))

  const bySlug = new Map(rows.map((r) => [r.slug, r.id]))

  for (const svc of wanted) {
    const serviceId = bySlug.get(svc.slug)
    if (!serviceId) {
      console.warn(`  unknown service "${svc.slug}" for ${record.name} - skipped`)
      continue
    }
    await db
      .insert(entityService)
      .values({
        entityId,
        serviceId,
        priceFrom: svc.priceFrom != null ? String(svc.priceFrom) : null,
        priceTo: svc.priceTo != null ? String(svc.priceTo) : null,
        currency: 'MKD',
        sourceId,
        verifiedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [entityService.entityId, entityService.serviceId],
        set: {
          priceFrom: svc.priceFrom != null ? String(svc.priceFrom) : null,
          priceTo: svc.priceTo != null ? String(svc.priceTo) : null,
          sourceId,
          verifiedAt: new Date(),
        },
      })
  }
}

/**
 * Photos are keyed on their filename or URL, so re-importing a CSV updates
 * the order rather than stacking duplicates.
 */
async function upsertPhotos(entityId: string, record: NormalizedRecord): Promise<void> {
  for (const [i, key] of (record.photos ?? []).entries()) {
    await db
      .insert(media)
      .values({ entityId, key, kind: 'photo', sort: i })
      .onConflictDoNothing()
  }

  // Logo and cover are singular: replacing one should not leave the old
  // behind, so the previous row of that kind goes first.
  for (const [kind, key] of [
    ['logo', record.logo],
    ['cover', record.cover],
  ] as const) {
    if (!key) continue
    await db.delete(media).where(and(eq(media.entityId, entityId), eq(media.kind, kind)))
    await db.insert(media).values({ entityId, key, kind, sort: 0 }).onConflictDoNothing()
  }
}

/** Hours are replaced per source, so a re-run cannot accumulate stale rows. */
async function replaceHours(
  entityId: string,
  record: NormalizedRecord,
  sourceId: string,
): Promise<void> {
  if (record.hours.length === 0) return

  await db
    .delete(openingHours)
    .where(and(eq(openingHours.entityId, entityId), eq(openingHours.sourceId, sourceId)))

  await db.insert(openingHours).values(
    record.hours.map((h) => ({
      entityId,
      weekday: h.weekday,
      opens: h.opens ?? null,
      closes: h.closes ?? null,
      closed: h.closed ?? false,
      sourceId,
    })),
  )
}
