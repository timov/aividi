import {
  and,
  attribute,
  category,
  db,
  entity,
  entityAttribute,
  entityCategory,
  eq,
  inArray,
  list,
  listItem,
  or,
  place,
  raw,
  subscription,
} from '@aividi/db'
import { evaluateGate, getModifier } from '@aividi/core'

/**
 * Materialise one published list: /{place}/{category}/{modifier?}.
 *
 * Two things happen here that are worth keeping straight.
 *
 * The ORGANIC order is the AIVIDI Score, nothing else. Money does not enter
 * this function's ranking at any point.
 *
 * The SPONSORED slots are a separate, capped set pinned above that list, taken
 * from active subscriptions. They are marked in the data (is_sponsored) so the
 * page can label them, and capped at two so the fold still belongs to the
 * ranking rather than to whoever paid.
 */

export const MAX_SPONSORED = 2

export interface BuildListResult {
  listId: string
  slug: string
  organic: number
  sponsored: number
  indexable: boolean
  gateReason: string
}

export async function buildList(
  placeSlug: string,
  categorySlug: string,
  modifierSlug?: string | null,
): Promise<BuildListResult | null> {
  const [pl] = await db.select().from(place).where(eq(place.slug, placeSlug)).limit(1)
  const [cat] = await db.select().from(category).where(eq(category.slug, categorySlug)).limit(1)
  if (!pl || !cat) return null

  const modifier = modifierSlug ? getModifier(modifierSlug) : null
  if (modifierSlug && !modifier) return null

  // A city list covers that city only. Villages in the municipality are their
  // own places and do not appear in the Strumica lists.
  const placeIds = await placeFamily(pl.id)

  const filters = [
    eq(entity.status, 'published'),
    inArray(entity.placeId, placeIds),
    eq(entityCategory.categoryId, cat.id),
  ]

  if (modifier?.requiresAttribute) {
    const [attr] = await db
      .select({ id: attribute.id })
      .from(attribute)
      .where(eq(attribute.slug, modifier.requiresAttribute))
      .limit(1)
    if (!attr) return null
    filters.push(
      raw`exists (select 1 from entity_attribute ea where ea.entity_id = ${entity.id} and ea.attribute_id = ${attr.id})`,
    )
  }

  if (modifier?.requiresPricedServices) {
    filters.push(
      raw`exists (select 1 from entity_service es where es.entity_id = ${entity.id} and es.price_from is not null)`,
    )
  }

  if (modifier?.requiresWeekend) {
    filters.push(
      raw`exists (select 1 from opening_hours oh where oh.entity_id = ${entity.id} and oh.weekday in (6, 7) and oh.closed = false)`,
    )
  }

  const rows = await db
    .select({ id: entity.id, score: entity.score })
    .from(entity)
    .innerJoin(entityCategory, eq(entityCategory.entityId, entity.id))
    .where(and(...filters))
    .orderBy(raw`${entity.score} desc nulls last`, entity.nameMk)

  const entityIds = rows.map((r) => r.id)

  // --- who is entitled to a sponsored slot --------------------------------
  const sponsoredIds = new Set<string>()
  if (entityIds.length > 0) {
    const subs = await db
      .select({ entityId: subscription.entityId })
      .from(subscription)
      .where(
        and(
          inArray(subscription.entityId, entityIds),
          eq(subscription.status, 'active'),
          or(eq(subscription.tier, 'featured'), eq(subscription.tier, 'ai_visibility')),
        ),
      )
    // Ordered by organic score so the cap is not first-come-first-served.
    for (const row of rows) {
      if (subs.some((s) => s.entityId === row.id) && sponsoredIds.size < MAX_SPONSORED) {
        sponsoredIds.add(row.id)
      }
    }
  }

  // --- the index gate ------------------------------------------------------
  const dimensions = modifier ? [modifier.dimension] : ['список по категорија и место']
  const gate = evaluateGate({
    qualifyingEntities: rows.length,
    distinctDimensions: dimensions,
    // Every page's intro is generated from real counts and real fields; there
    // is no template with a hole in it to fall back on.
    hasDataDrivenIntro: rows.length > 0,
  })

  const title = modifier
    ? modifier.title(cat.nameMk, pl.nameMk)
    : `${cat.nameMk} во ${pl.nameMk}`

  const [saved] = await db
    .insert(list)
    .values({
      placeId: pl.id,
      categoryId: cat.id,
      modifier: modifierSlug ?? null,
      language: 'mk',
      titleMk: title,
      isIndexable: gate.indexable,
      gateReason: gate.reason,
      publishedAt: gate.indexable ? new Date() : null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [list.placeId, list.categoryId, list.modifier, list.language],
      set: {
        titleMk: title,
        isIndexable: gate.indexable,
        gateReason: gate.reason,
        publishedAt: gate.indexable ? new Date() : null,
        updatedAt: new Date(),
      },
    })
    .returning({ id: list.id })

  if (!saved) return null

  await db.delete(listItem).where(eq(listItem.listId, saved.id))

  if (rows.length > 0) {
    await db.insert(listItem).values(
      rows.map((row, i) => ({
        listId: saved.id,
        entityId: row.id,
        rank: i + 1,
        scoreSnapshot: row.score,
        isSponsored: sponsoredIds.has(row.id),
      })),
    )
  }

  return {
    listId: saved.id,
    slug: modifierSlug ? `${pl.slug}/${cat.slug}/${modifierSlug}` : `${pl.slug}/${cat.slug}`,
    organic: rows.length - sponsoredIds.size,
    sponsored: sponsoredIds.size,
    indexable: gate.indexable,
    gateReason: gate.reason,
  }
}

/**
 * A place plus anything nested under it.
 *
 * A `grad` has no children, so a city list is that city and nothing else -
 * businesses in Муртино or Вељуса belong to those places, not to Струмица.
 * An `opstina` list does cover its villages, which is the level to use when
 * the municipality is genuinely the unit someone is searching.
 */
export async function placeFamily(placeId: string): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(raw`
    with recursive tree as (
      select id, parent_id from place where id = ${placeId}
      union all
      select p.id, p.parent_id from place p join tree t on p.parent_id = t.id
    )
    select id from tree
  `)
  return [...rows].map((r) => r.id)
}

/**
 * Rebuild lists for every town that has something published. This is the one
 * to run after a nationwide import — rebuilding a single town by hand does not
 * scale past the first couple of cities.
 */
export async function rebuildAllLists(): Promise<BuildListResult[]> {
  const towns = await db
    .selectDistinct({ slug: place.slug })
    .from(entity)
    .innerJoin(place, eq(place.id, entity.placeId))
    .where(eq(entity.status, 'published'))

  const out: BuildListResult[] = []
  for (const town of towns) {
    out.push(...(await rebuildListsForPlace(town.slug)))
  }
  return out
}

/** Rebuild every list for a place: the category pages and all their facets. */
export async function rebuildListsForPlace(placeSlug: string): Promise<BuildListResult[]> {
  const cats = await db
    .select({ slug: category.slug })
    .from(category)
    .where(eq(category.isPilot, true))

  const out: BuildListResult[] = []

  for (const cat of cats) {
    const base = await buildList(placeSlug, cat.slug, null)
    if (base) out.push(base)

    for (const modifierSlug of ['najdobri', 'dostava', 'otvoreno-vikend', 'parking', 'ceni']) {
      const facet = await buildList(placeSlug, cat.slug, modifierSlug)
      if (facet) out.push(facet)
    }
  }

  return out
}
