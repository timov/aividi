import {
  db,
  entity,
  entityField,
  eq,
  and,
  raw,
  source,
  type Db,
} from '@aividi/db'
import { hostOf, matchKey, resolveField, slugify, toLatin, type FieldCandidate } from '@aividi/core'

/**
 * The provenance layer in two functions.
 *
 *   applyFields()       records what a source told us, without touching the entity
 *   materializeEntity() recomputes the entity from everything we have been told
 *
 * Nothing else in the codebase writes to entity columns directly. That is the
 * whole point: re-ingesting a source, letting an owner correct their hours, or
 * proving to a customer why their data says what it says are all the same
 * operation, and none of them can silently lose an earlier value.
 */

/**
 * entity_field.key -> the property name on the `entity` table object.
 *
 * These have to be the JS property names, not the database column names.
 * Drizzle's .set() maps camelCase properties onto snake_case columns itself,
 * and silently ignores keys it does not recognise - so writing `phone_e164`
 * here drops the value with no error at all.
 */
export const FIELD_COLUMNS = {
  name_mk: 'nameMk',
  name_sq: 'nameSq',
  legal_name: 'legalName',
  embs: 'embs',
  edb: 'edb',
  address: 'address',
  lat: 'lat',
  lng: 'lng',
  phone_e164: 'phoneE164',
  email: 'email',
  website: 'website',
  facebook: 'facebook',
  instagram: 'instagram',
  description_mk: 'descriptionMk',
  summary_mk: 'summaryMk',
} as const

export type FieldKey = keyof typeof FIELD_COLUMNS

const NUMERIC_KEYS = new Set<FieldKey>(['lat', 'lng'])

export interface ApplyFieldsInput {
  entityId: string
  sourceId: string
  sourceRecordId?: string | null
  fields: Partial<Record<FieldKey, string | number | null>>
  /** 0..1. Defaults to the source's own trust level. */
  confidence?: number
  verifiedAt?: Date | null
  tx?: Db
}

export async function applyFields(input: ApplyFieldsInput): Promise<number> {
  const client = input.tx ?? db

  const [src] = await client
    .select({ trust: source.trust })
    .from(source)
    .where(eq(source.id, input.sourceId))
    .limit(1)

  const confidence = input.confidence ?? (src ? src.trust / 100 : 0.5)
  const now = new Date()
  let written = 0

  for (const [key, value] of Object.entries(input.fields)) {
    if (value === null || value === undefined || value === '') continue
    if (!(key in FIELD_COLUMNS)) continue

    await client
      .insert(entityField)
      .values({
        entityId: input.entityId,
        key,
        value: String(value),
        sourceId: input.sourceId,
        sourceRecordId: input.sourceRecordId ?? null,
        confidence,
        verifiedAt: input.verifiedAt ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [entityField.entityId, entityField.key, entityField.sourceId],
        set: {
          value: String(value),
          confidence,
          sourceRecordId: input.sourceRecordId ?? null,
          verifiedAt: input.verifiedAt ?? null,
          updatedAt: now,
        },
      })
    written++
  }

  return written
}

/**
 * Recompute every entity column from its field candidates.
 *
 * The resolution rule itself lives in @aividi/core so it can be argued about
 * in a test: source trust, then confidence, then how recently a human checked,
 * with recency breaking ties.
 */
export async function materializeEntity(entityId: string, tx?: Db): Promise<void> {
  const client = tx ?? db

  const rows = await client
    .select({
      key: entityField.key,
      value: entityField.value,
      confidence: entityField.confidence,
      verifiedAt: entityField.verifiedAt,
      updatedAt: entityField.updatedAt,
      sourceId: entityField.sourceId,
      trust: source.trust,
      sourceKind: source.kind,
    })
    .from(entityField)
    .innerJoin(source, eq(source.id, entityField.sourceId))
    .where(eq(entityField.entityId, entityId))

  if (rows.length === 0) return

  const byKey = new Map<string, FieldCandidate<string>[]>()
  for (const row of rows) {
    if (row.value === null) continue
    const list = byKey.get(row.key) ?? []
    list.push({
      value: row.value,
      trust: row.trust,
      confidence: row.confidence,
      verifiedAt: row.verifiedAt,
      updatedAt: row.updatedAt,
      sourceId: row.sourceId,
      sourceKind: row.sourceKind,
    })
    byKey.set(row.key, list)
  }

  const update: Record<string, unknown> = { updatedAt: new Date() }

  for (const [key, candidates] of byKey) {
    if (!(key in FIELD_COLUMNS)) continue
    const column = FIELD_COLUMNS[key as FieldKey]
    const winner = resolveField(candidates)
    if (!winner) continue

    if (NUMERIC_KEYS.has(key as FieldKey)) {
      const n = Number(winner.value)
      if (Number.isFinite(n)) update[column] = n
    } else {
      update[column] = winner.value
    }
  }

  // Derived columns are never sourced - they are always recomputed from the
  // winning name, so the trigram index can't drift out of sync with it.
  const name = update.nameMk
  if (typeof name === 'string' && name) {
    update.nameLat = toLatin(name)
    update.nameNorm = matchKey(name)
  }

  const website = update.website
  update.websiteHost = typeof website === 'string' ? hostOf(website) : null

  await client
    .update(entity)
    .set(update as never)
    .where(eq(entity.id, entityId))

  await ensureSlug(entityId, client)
}

/**
 * Slugs are assigned once and then left alone - a URL that moves loses every
 * link and citation pointing at it. Collisions get a numeric suffix.
 */
export async function ensureSlug(entityId: string, tx?: Db): Promise<string | null> {
  const client = tx ?? db

  const [row] = await client
    .select({ slug: entity.slug, name: entity.nameMk })
    .from(entity)
    .where(eq(entity.id, entityId))
    .limit(1)

  if (!row || row.slug) return row?.slug ?? null

  const base = slugify(row.name) || 'biznis'

  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`
    const [taken] = await client
      .select({ id: entity.id })
      .from(entity)
      .where(eq(entity.slug, candidate))
      .limit(1)
    if (taken) continue

    await client.update(entity).set({ slug: candidate }).where(eq(entity.id, entityId))
    return candidate
  }

  // 25 businesses with the same name in one country is not a slug problem.
  const fallback = `${base}-${entityId.slice(0, 8)}`
  await client.update(entity).set({ slug: fallback }).where(eq(entity.id, entityId))
  return fallback
}

/** Used by the admin "mark verified" action. */
export async function markVerified(
  entityId: string,
  by: string,
  manualSourceId: string,
): Promise<void> {
  const now = new Date()
  await db
    .update(entityField)
    .set({ verifiedAt: now, confidence: 1 })
    .where(and(eq(entityField.entityId, entityId), eq(entityField.sourceId, manualSourceId)))

  await db
    .update(entity)
    .set({ verifiedAt: now, verifiedBy: by, updatedAt: now })
    .where(eq(entity.id, entityId))

  await materializeEntity(entityId)
}
