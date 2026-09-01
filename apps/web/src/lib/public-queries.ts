import {
  and,
  attribute,
  article,
  articleEntry,
  articleFaq,
  author,
  category,
  count,
  db,
  desc,
  entity,
  entityAttribute,
  entityCategory,
  entityService,
  eq,
  ilike,
  inArray,
  isNotNull,
  list,
  listItem,
  ne,
  openingHours,
  or,
  place,
  raw,
  service,
} from '@aividi/db'
import { media, scoreRun } from '@aividi/db'
import type { Place } from '@aividi/db'
import { matchKey, type HourRow } from '@aividi/core'
import { isPilotPlace, PILOT_PLACES } from './pilot'

/** Appended to a query's own filters wherever it joins `place`. `undefined`
 *  when every town is live, so `and(...)` calls need no special-casing. */
function pilotFilter() {
  return PILOT_PLACES ? inArray(place.slug, PILOT_PLACES) : undefined
}

/**
 * Read side for the public pages.
 *
 * Everything a card needs is fetched in batches keyed on the entity ids from
 * one list, rather than per card. A category page is 5 queries no matter how
 * many businesses it holds.
 */

export interface CardData {
  id: string
  slug: string | null
  name: string
  description: string | null
  phone: string | null
  address: string | null
  placeName: string | null
  placeSlug: string | null
  categorySlug: string | null
  categoryName: string | null
  /** Our read of what customers say. Never third-party review text. */
  summary: string | null
  lat: number | null
  lng: number | null
  website: string | null
  facebook: string | null
  instagram: string | null
  score: number | null
  karma: number | null
  karmaReviews: number | null
  verifiedAt: Date | null
  hours: HourRow[]
  attributes: string[]
  priceFrom: number | null
  priceTo: number | null
  isSponsored: boolean
  /** Ordered by `sort`; the first is the cover. Empty until photos exist. */
  photos: Photo[]
  /** The business's own mark, taken from its own website or supplied by us. */
  logo: Photo | null
  /** The wide image at the top of the profile. */
  cover: Photo | null
}

export interface Photo {
  /** Absolute URL, or a path under /uploads/ that we serve ourselves. */
  src: string
  credit: string | null
  width: number | null
  height: number | null
}

/**
 * `next build` prerenders these pages, and a build should not require a live
 * database - CI does not have one, and neither does a laptop before
 * `docker compose up`. During the build phase only, a failed query yields an
 * empty page that ISR fills in on the first request after deploy.
 *
 * At runtime the error is rethrown. A page that silently renders "нема
 * податоци" because Postgres blipped would get cached that way for 15 minutes,
 * which is worse than a 500.
 */
const IS_BUILD = process.env.NEXT_PHASE === 'phase-production-build'

async function safe<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run()
  } catch (err) {
    if (IS_BUILD) {
      console.warn('[aividi] build-time query skipped:', (err as Error).message)
      return fallback
    }
    throw err
  }
}

export async function getPlace(slug: string) {
  return safe(async () => {
    if (!isPilotPlace(slug)) return null
    const [row] = await db.select().from(place).where(eq(place.slug, slug)).limit(1)
    return row ?? null
  }, null)
}

export async function getCategory(slug: string) {
  const [row] = await db.select().from(category).where(eq(category.slug, slug)).limit(1)
  return row ?? null
}

/**
 * Towns that actually have something published, busiest first.
 *
 * This replaces "is_pilot" as the thing the site renders from: a town appears
 * the moment it has content and disappears if it does not, so adding Bitola is
 * a matter of importing Bitola's businesses rather than editing a flag.
 */
export async function getActivePlaces(limit = 40) {
  return safe(
    () =>
      db
        .select({
          slug: place.slug,
          nameMk: place.nameMk,
          kind: place.kind,
          n: raw<number>`count(*)::int`,
        })
        .from(entity)
        .innerJoin(place, eq(place.id, entity.placeId))
        .where(and(eq(entity.status, 'published'), pilotFilter()))
        .groupBy(place.slug, place.nameMk, place.kind)
        .orderBy(raw`count(*) desc`)
        .limit(limit),
    [] as Array<{ slug: string; nameMk: string; kind: string; n: number }>,
  )
}

/** Every category with published businesses, and where most of them are. */
export async function getAllCategories() {
  return safe(
    () =>
      db
        .select({
          slug: category.slug,
          name: category.nameMk,
          n: raw<number>`count(*)::int`,
          topPlaceSlug: raw<string>`(array_agg(${place.slug} order by ${place.slug}))[1]`,
          topPlaceName: raw<string>`(array_agg(${place.nameMk} order by ${place.nameMk}))[1]`,
        })
        .from(entity)
        .innerJoin(entityCategory, eq(entityCategory.entityId, entity.id))
        .innerJoin(category, eq(category.id, entityCategory.categoryId))
        .innerJoin(place, eq(place.id, entity.placeId))
        .where(and(eq(entity.status, 'published'), pilotFilter()))
        .groupBy(category.slug, category.nameMk, category.sort)
        .orderBy(category.sort),
    [] as Array<{
      slug: string
      name: string
      n: number
      topPlaceSlug: string
      topPlaceName: string
    }>,
  )
}

/** Every "најдобри" list that cleared the index gate. */
export async function getRankedLists() {
  return safe(
    async () => {
      const rows = await db
        .select({
          title: list.titleMk,
          placeSlug: place.slug,
          placeName: place.nameMk,
          categorySlug: category.slug,
          n: raw<number>`(select count(*) from list_item li where li.list_id = ${list.id})::int`,
        })
        .from(list)
        .innerJoin(place, eq(place.id, list.placeId))
        .innerJoin(category, eq(category.id, list.categoryId))
        .where(and(eq(list.modifier, 'najdobri'), eq(list.isIndexable, true), pilotFilter()))
        .orderBy(place.nameMk, category.sort)
      return rows.map((r) => ({
        ...r,
        slug: `/${r.placeSlug}/${r.categorySlug}/najdobri`,
      }))
    },
    [] as Array<{
      title: string
      placeSlug: string
      placeName: string
      categorySlug: string
      n: number
      slug: string
    }>,
  )
}

export async function getPilotPlaces() {
  return safe(
    () => db.select().from(place).where(eq(place.isPilot, true)).orderBy(desc(place.population)),
    [] as Place[],
  )
}

/** Categories that actually have something published in this place. */
export async function getPlaceCategories(placeSlug: string) {
  return safe(() => db
    .select({
      slug: category.slug,
      name: category.nameMk,
      n: raw<number>`count(distinct ${entity.id})::int`,
    })
    .from(list)
    .innerJoin(place, eq(place.id, list.placeId))
    .innerJoin(category, eq(category.id, list.categoryId))
    .innerJoin(listItem, eq(listItem.listId, list.id))
    .innerJoin(entity, eq(entity.id, listItem.entityId))
    .where(and(eq(place.slug, placeSlug), raw`${list.modifier} is null`))
    .groupBy(category.slug, category.nameMk, category.sort)
    .orderBy(category.sort), [])
}

export interface ListPage {
  id: string
  title: string
  isIndexable: boolean
  gateReason: string | null
  updatedAt: Date
  placeName: string
  placeSlug: string
  categoryName: string
  categorySlug: string
  schemaType: string
  modifier: string | null
  sponsored: CardData[]
  organic: CardData[]
}

export async function getListPage(
  placeSlug: string,
  categorySlug: string,
  modifier: string | null,
): Promise<ListPage | null> {
  return safe(() => loadListPage(placeSlug, categorySlug, modifier), null)
}

async function loadListPage(
  placeSlug: string,
  categorySlug: string,
  modifier: string | null,
): Promise<ListPage | null> {
  if (!isPilotPlace(placeSlug)) return null

  const [row] = await db
    .select({
      id: list.id,
      title: list.titleMk,
      isIndexable: list.isIndexable,
      gateReason: list.gateReason,
      updatedAt: list.updatedAt,
      modifier: list.modifier,
      placeName: place.nameMk,
      placeSlug: place.slug,
      categoryName: category.nameMk,
      categorySlug: category.slug,
      schemaType: category.schemaType,
    })
    .from(list)
    .innerJoin(place, eq(place.id, list.placeId))
    .innerJoin(category, eq(category.id, list.categoryId))
    .where(
      and(
        eq(place.slug, placeSlug),
        eq(category.slug, categorySlug),
        modifier ? eq(list.modifier, modifier) : raw`${list.modifier} is null`,
      ),
    )
    .limit(1)

  if (!row) return null

  const items = await db
    .select({ entityId: listItem.entityId, isSponsored: listItem.isSponsored, rank: listItem.rank })
    .from(listItem)
    .where(eq(listItem.listId, row.id))
    .orderBy(listItem.rank)

  const cards = await hydrateCards(
    items.map((i) => i.entityId),
    new Map(items.map((i) => [i.entityId, i.isSponsored])),
  )

  return {
    ...row,
    sponsored: cards.filter((c) => c.isSponsored),
    organic: cards.filter((c) => !c.isSponsored),
  }
}

/** Turns a set of entity ids into fully rendered cards, in the order given. */
export async function hydrateCards(
  entityIds: string[],
  sponsored?: Map<string, boolean>,
): Promise<CardData[]> {
  if (entityIds.length === 0) return []

  const rows = await db
    .select({
      id: entity.id,
      slug: entity.slug,
      name: entity.nameMk,
      description: entity.descriptionMk,
      summary: entity.summaryMk,
      phone: entity.phoneE164,
      address: entity.address,
      lat: entity.lat,
      lng: entity.lng,
      website: entity.website,
      facebook: entity.facebook,
      instagram: entity.instagram,
      score: entity.score,
      karma: entity.karma,
      karmaReviews: entity.karmaReviews,
      verifiedAt: entity.verifiedAt,
      placeName: place.nameMk,
      placeSlug: place.slug,
      categorySlug: category.slug,
      categoryName: category.nameMk,
    })
    .from(entity)
    .leftJoin(place, eq(place.id, entity.placeId))
    .leftJoin(
      entityCategory,
      and(eq(entityCategory.entityId, entity.id), eq(entityCategory.isPrimary, true)),
    )
    .leftJoin(category, eq(category.id, entityCategory.categoryId))
    .where(inArray(entity.id, entityIds))

  const hourRows = await db
    .select({
      entityId: openingHours.entityId,
      weekday: openingHours.weekday,
      opens: openingHours.opens,
      closes: openingHours.closes,
      closed: openingHours.closed,
    })
    .from(openingHours)
    .where(inArray(openingHours.entityId, entityIds))

  const attrRows = await db
    .select({ entityId: entityAttribute.entityId, name: attribute.nameMk })
    .from(entityAttribute)
    .innerJoin(attribute, eq(attribute.id, entityAttribute.attributeId))
    .where(inArray(entityAttribute.entityId, entityIds))
    .orderBy(attribute.sort)

  const photoRows = await db
    .select({
      entityId: media.entityId,
      key: media.key,
      kind: media.kind,
      credit: media.credit,
      width: media.width,
      height: media.height,
      sort: media.sort,
    })
    .from(media)
    .where(and(inArray(media.entityId, entityIds), inArray(media.kind, ['photo', 'logo', 'cover'])))
    .orderBy(media.sort)

  const priceRows = await db
    .select({
      entityId: entityService.entityId,
      min: raw<string | null>`min(${entityService.priceFrom})`,
      max: raw<string | null>`max(coalesce(${entityService.priceTo}, ${entityService.priceFrom}))`,
    })
    .from(entityService)
    .where(inArray(entityService.entityId, entityIds))
    .groupBy(entityService.entityId)

  const photosBy = groupBy(photoRows, (r) => r.entityId)
  const hoursBy = groupBy(hourRows, (r) => r.entityId)
  const attrsBy = groupBy(attrRows, (r) => r.entityId)
  const priceBy = new Map(priceRows.map((r) => [r.entityId, r]))
  const byId = new Map(rows.map((r) => [r.id, r]))

  const out: CardData[] = []
  for (const id of entityIds) {
    const row = byId.get(id)
    if (!row) continue
    const price = priceBy.get(id)
    out.push({
      ...row,
      hours: (hoursBy.get(id) ?? []).map((h) => ({
        weekday: h.weekday,
        opens: h.opens,
        closes: h.closes,
        closed: h.closed,
      })),
      attributes: (attrsBy.get(id) ?? []).map((a) => a.name),
      priceFrom: price?.min ? Number(price.min) : null,
      priceTo: price?.max ? Number(price.max) : null,
      isSponsored: sponsored?.get(id) ?? false,
      logo: pick(photosBy.get(id) ?? [], 'logo'),
      cover: pick(photosBy.get(id) ?? [], 'cover'),
      photos: (photosBy.get(id) ?? []).filter((p) => p.kind === 'photo').map((p) => ({
        src: toSrc(p.key),
        credit: p.credit,
        width: p.width,
        height: p.height,
      })),
    })
  }
  return out
}

export interface EntityPage extends CardData {
  /** Our summary of what customers say. Never third-party review text. */
  summary: string | null
  /**
   * Where the score came from, component by component. This is the whole
   * argument for the score being public: a business can see exactly which
   * number to move, and every one of them is free to move.
   */
  scoreComponents: Record<string, number> | null
  karmaComponents: Record<string, number> | null
  karmaConfidence: string | null
  website: string | null
  facebook: string | null
  instagram: string | null
  email: string | null
  lat: number | null
  lng: number | null
  categoryName: string | null
  schemaType: string
  services: Array<{ name: string; unit: string; from: number | null; to: number | null }>
  sources: string[]
}

export async function getEntityPage(slug: string): Promise<EntityPage | null> {
  return safe(() => loadEntityPage(slug), null)
}

async function loadEntityPage(slug: string): Promise<EntityPage | null> {
  const [row] = await db
    .select({
      id: entity.id,
      status: entity.status,
      summary: entity.summaryMk,
      karmaComponents: entity.karmaComponents,
      karmaConfidence: entity.karmaConfidence,
      website: entity.website,
      facebook: entity.facebook,
      instagram: entity.instagram,
      email: entity.email,
      lat: entity.lat,
      lng: entity.lng,
      categoryName: category.nameMk,
      schemaType: category.schemaType,
    })
    .from(entity)
    .innerJoin(place, eq(place.id, entity.placeId))
    .leftJoin(
      entityCategory,
      and(eq(entityCategory.entityId, entity.id), eq(entityCategory.isPrimary, true)),
    )
    .leftJoin(category, eq(category.id, entityCategory.categoryId))
    .where(and(eq(entity.slug, slug), eq(entity.status, 'published'), pilotFilter()))
    .limit(1)

  if (!row) return null

  const [card] = await hydrateCards([row.id])
  if (!card) return null

  const [latestScore] = await db
    .select({ components: scoreRun.components })
    .from(scoreRun)
    .where(eq(scoreRun.entityId, row.id))
    .orderBy(desc(scoreRun.computedAt))
    .limit(1)

  const services = await db
    .select({
      name: service.nameMk,
      unit: service.unit,
      from: entityService.priceFrom,
      to: entityService.priceTo,
    })
    .from(entityService)
    .innerJoin(service, eq(service.id, entityService.serviceId))
    .where(eq(entityService.entityId, row.id))
    .orderBy(service.sort)

  return {
    ...card,
    summary: row.summary,
    scoreComponents: latestScore?.components ?? null,
    karmaComponents: row.karmaComponents,
    karmaConfidence: row.karmaConfidence,
    website: row.website,
    facebook: row.facebook,
    instagram: row.instagram,
    email: row.email,
    lat: row.lat,
    lng: row.lng,
    categoryName: row.categoryName,
    schemaType: row.schemaType ?? 'LocalBusiness',
    services: services.map((s) => ({
      name: s.name,
      unit: s.unit,
      from: s.from ? Number(s.from) : null,
      to: s.to ? Number(s.to) : null,
    })),
    sources: [],
  }
}

/** Simple name / category search across published entities. */
export async function search(q: string): Promise<CardData[]> {
  return safe(() => runSearch(q), [])
}

async function runSearch(q: string): Promise<CardData[]> {
  const term = q.trim()
  if (term.length < 2) return []

  const rows = await db
    .select({ id: entity.id })
    .from(entity)
    .innerJoin(place, eq(place.id, entity.placeId))
    .leftJoin(entityCategory, eq(entityCategory.entityId, entity.id))
    .leftJoin(category, eq(category.id, entityCategory.categoryId))
    .where(
      and(
        eq(entity.status, 'published'),
        or(
          ilike(entity.nameMk, `%${term}%`),
          ilike(entity.nameLat, `%${term}%`),
          ilike(entity.nameNorm, `%${matchKey(term)}%`),
          ilike(category.nameMk, `%${term}%`),
        ),
        pilotFilter(),
      ),
    )
    .orderBy(raw`${entity.score} desc nulls last`)
    .limit(40)

  const unique = [...new Set(rows.map((r) => r.id))]
  return hydrateCards(unique)
}

/** Every indexable URL, for the sitemap. */
export async function getIndexableUrls() {
  return safe(() => loadIndexableUrls(), { lists: [], entities: [] })
}

async function loadIndexableUrls() {
  const lists = await db
    .select({
      placeSlug: place.slug,
      categorySlug: category.slug,
      modifier: list.modifier,
      updatedAt: list.updatedAt,
    })
    .from(list)
    .innerJoin(place, eq(place.id, list.placeId))
    .innerJoin(category, eq(category.id, list.categoryId))
    .where(and(eq(list.isIndexable, true), pilotFilter()))

  const entities = await db
    .select({
      slug: entity.slug,
      placeSlug: place.slug,
      categorySlug: category.slug,
      updatedAt: entity.updatedAt,
    })
    .from(entity)
    .leftJoin(place, eq(place.id, entity.placeId))
    .leftJoin(
      entityCategory,
      and(eq(entityCategory.entityId, entity.id), eq(entityCategory.isPrimary, true)),
    )
    .leftJoin(category, eq(category.id, entityCategory.categoryId))
    .where(and(eq(entity.status, 'published'), ne(entity.status, 'merged'), pilotFilter()))

  return { lists, entities }
}

export interface SiteStats {
  businesses: number
  categories: number
  verified: number
  priced: number
  towns: number
}

/**
 * The numbers behind the home page's stat strip. All real, all live.
 *
 * Five small queries rather than one with subqueries: each of "priced",
 * "categories" and "towns" needs its own join back to `place` to stay
 * pilot-scoped, and a hand-rolled raw subquery per metric would have meant
 * re-deriving the pilot filter as a string in four different places instead
 * of reusing pilotFilter() once each.
 */
export async function getSiteStats(): Promise<SiteStats> {
  return safe(async () => {
    const [businesses] = await db
      .select({ n: count() })
      .from(entity)
      .innerJoin(place, eq(place.id, entity.placeId))
      .where(and(eq(entity.status, 'published'), pilotFilter()))

    const [verified] = await db
      .select({ n: count() })
      .from(entity)
      .innerJoin(place, eq(place.id, entity.placeId))
      .where(and(eq(entity.status, 'published'), isNotNull(entity.verifiedAt), pilotFilter()))

    const [priced] = await db
      .select({ n: raw<number>`count(distinct ${entityService.entityId})::int` })
      .from(entityService)
      .innerJoin(entity, eq(entity.id, entityService.entityId))
      .innerJoin(place, eq(place.id, entity.placeId))
      .where(and(isNotNull(entityService.priceFrom), pilotFilter()))

    const [categories] = await db
      .select({ n: raw<number>`count(distinct ${entityCategory.categoryId})::int` })
      .from(entityCategory)
      .innerJoin(entity, eq(entity.id, entityCategory.entityId))
      .innerJoin(place, eq(place.id, entity.placeId))
      .where(and(eq(entity.status, 'published'), pilotFilter()))

    const [towns] = await db
      .select({ n: raw<number>`count(distinct ${entity.placeId})::int` })
      .from(entity)
      .innerJoin(place, eq(place.id, entity.placeId))
      .where(and(eq(entity.status, 'published'), eq(place.kind, 'grad'), pilotFilter()))

    return {
      businesses: businesses?.n ?? 0,
      verified: verified?.n ?? 0,
      priced: priced?.n ?? 0,
      categories: categories?.n ?? 0,
      towns: towns?.n ?? 0,
    }
  }, { businesses: 0, categories: 0, verified: 0, priced: 0, towns: 0 })
}

/** Most recently checked profiles — proof the data is actually maintained. */
export async function getRecentlyVerified(limit = 4): Promise<CardData[]> {
  return safe(async () => {
    const rows = await db
      .select({ id: entity.id })
      .from(entity)
      .innerJoin(place, eq(place.id, entity.placeId))
      .where(and(eq(entity.status, 'published'), isNotNull(entity.verifiedAt), pilotFilter()))
      .orderBy(desc(entity.verifiedAt))
      .limit(limit)
    return hydrateCards(rows.map((r) => r.id))
  }, [])
}

/** Highest-scoring published profiles across every category. */
export async function getTopScored(limit = 4): Promise<CardData[]> {
  return safe(async () => {
    const rows = await db
      .select({ id: entity.id })
      .from(entity)
      .innerJoin(place, eq(place.id, entity.placeId))
      .where(and(eq(entity.status, 'published'), isNotNull(entity.score), pilotFilter()))
      .orderBy(desc(entity.score))
      .limit(limit)
    return hydrateCards(rows.map((r) => r.id))
  }, [])
}

export async function countPublished(): Promise<number> {
  return safe(async () => {
    const [row] = await db
      .select({ n: count() })
      .from(entity)
      .innerJoin(place, eq(place.id, entity.placeId))
      .where(and(eq(entity.status, 'published'), pilotFilter()))
    return row?.n ?? 0
  }, 0)
}

/** Pulls the single logo or cover row out of an entity's media. */
function pick(
  rows: Array<{ kind: string; key: string; credit: string | null; width: number | null; height: number | null }>,
  kind: string,
): Photo | null {
  const row = rows.find((r) => r.kind === kind)
  return row
    ? { src: toSrc(row.key), credit: row.credit, width: row.width, height: row.height }
    : null
}

/** Absolute URLs pass through; anything else is served from /uploads or /logos. */
function toSrc(key: string): string {
  if (key.startsWith('http')) return key
  if (key.startsWith('logos/')) return `/${key}`
  return `/uploads/${key.replace(/^\/+/, '')}`
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const row of rows) {
    const k = key(row)
    const list = out.get(k) ?? []
    list.push(row)
    out.set(k, list)
  }
  return out
}

/* ==========================================================================
   Editorial articles
   ========================================================================== */

export interface ArticleEntryData {
  rank: number
  role: string | null
  verdict: string | null
  pick: string | null
  warning: string | null
  embedUrl: string | null
  card: CardData
}

export interface ArticleFaqData {
  question: string
  answer: string
}

export interface ArticlePage {
  slug: string
  headline: string
  summary: string
  intro: string | null
  outro: string | null
  coverKey: string | null
  coverCredit: string | null
  placeName: string
  placeSlug: string
  categoryName: string
  categorySlug: string
  publishedAt: Date | null
  updatedAt: Date
  authorName: string | null
  authorRole: string | null
  authorBio: string | null
  authorUrl: string | null
  entries: ArticleEntryData[]
  faq: ArticleFaqData[]
}

/** Index of published articles, newest change first. */
export async function getArticles(): Promise<
  Array<{
    slug: string
    headline: string
    summary: string
    coverKey: string | null
    placeName: string
    categoryName: string
    updatedAt: Date
    count: number
  }>
> {
  return safe(async () => {
    const rows = await db
      .select({
        slug: article.slug,
        headline: article.headline,
        summary: article.summary,
        coverKey: article.coverKey,
        placeName: place.nameMk,
        categoryName: category.nameMk,
        updatedAt: article.updatedAt,
        count: count(articleEntry.id),
      })
      .from(article)
      .innerJoin(place, eq(place.id, article.placeId))
      .innerJoin(category, eq(category.id, article.categoryId))
      .leftJoin(articleEntry, eq(articleEntry.articleId, article.id))
      .where(and(eq(article.status, 'published'), pilotFilter()))
      .groupBy(article.id, place.nameMk, category.nameMk)
      .orderBy(desc(article.updatedAt))
    return rows.map((r) => ({ ...r, count: Number(r.count) }))
  }, [])
}

export async function getArticle(slug: string): Promise<ArticlePage | null> {
  return safe(async () => {
    const [row] = await db
      .select({
        id: article.id,
        slug: article.slug,
        headline: article.headline,
        summary: article.summary,
        intro: article.intro,
        outro: article.outro,
        coverKey: article.coverKey,
        coverCredit: article.coverCredit,
        publishedAt: article.publishedAt,
        updatedAt: article.updatedAt,
        placeName: place.nameMk,
        placeSlug: place.slug,
        categoryName: category.nameMk,
        categorySlug: category.slug,
        authorName: author.name,
        authorRole: author.role,
        authorBio: author.bio,
        authorUrl: author.url,
      })
      .from(article)
      .innerJoin(place, eq(place.id, article.placeId))
      .innerJoin(category, eq(category.id, article.categoryId))
      .leftJoin(author, eq(author.id, article.authorId))
      .where(and(eq(article.slug, slug), eq(article.status, 'published'), pilotFilter()))
      .limit(1)

    if (!row) return null

    const entryRows = await db
      .select({
        entityId: articleEntry.entityId,
        rank: articleEntry.rank,
        role: articleEntry.role,
        verdict: articleEntry.verdict,
        pick: articleEntry.pick,
        warning: articleEntry.warning,
        embedUrl: articleEntry.embedUrl,
      })
      .from(articleEntry)
      .where(eq(articleEntry.articleId, row.id))
      .orderBy(articleEntry.rank)

    // The facts come from the profiles at render time, never from the article,
    // so a price or an opening hour cannot go stale inside the prose.
    const cards = await hydrateCards(entryRows.map((e) => e.entityId))
    const byId = new Map(cards.map((c) => [c.id, c]))

    const faq = await db
      .select({ question: articleFaq.question, answer: articleFaq.answer })
      .from(articleFaq)
      .where(eq(articleFaq.articleId, row.id))
      .orderBy(articleFaq.sort)

    return {
      ...row,
      entries: entryRows.flatMap((e) => {
        const card = byId.get(e.entityId)
        return card
          ? [
              {
                rank: e.rank,
                role: e.role,
                verdict: e.verdict,
                pick: e.pick,
                warning: e.warning,
                embedUrl: e.embedUrl,
                card,
              },
            ]
          : []
      }),
      faq,
    }
  }, null)
}

/**
 * Other articles worth following from this one.
 *
 * Same category elsewhere first — someone reading about restaurants in Skopje
 * is far more likely to want restaurants in Bitola than dentists in Skopje —
 * then anything else in the same town.
 */
export async function getRelatedArticles(
  slug: string,
  limit = 4,
): Promise<Array<{ slug: string; headline: string; placeName: string; categoryName: string }>> {
  return safe(async () => {
    const [self] = await db
      .select({ placeId: article.placeId, categoryId: article.categoryId })
      .from(article)
      .where(eq(article.slug, slug))
      .limit(1)

    if (!self) return []

    const rows = await db
      .select({
        slug: article.slug,
        headline: article.headline,
        placeName: place.nameMk,
        categoryName: category.nameMk,
        sameCategory: article.categoryId,
      })
      .from(article)
      .innerJoin(place, eq(place.id, article.placeId))
      .innerJoin(category, eq(category.id, article.categoryId))
      .where(and(eq(article.status, 'published'), ne(article.slug, slug), pilotFilter()))
      .orderBy(desc(article.updatedAt))

    return rows
      .sort((a, b) => {
        const av = a.sameCategory === self.categoryId ? 0 : 1
        const bv = b.sameCategory === self.categoryId ? 0 : 1
        return av - bv
      })
      .slice(0, limit)
      .map(({ sameCategory: _ignored, ...rest }) => rest)
  }, [])
}

/**
 * Every public URL that should exist, indexable or not.
 *
 * Deliberately NOT getIndexableUrls(): that one answers "what belongs in the
 * sitemap", which is a smaller set — a list below the index gate still renders
 * and is still linked from its town page, it just ships noindex. Using the
 * sitemap query to decide what to pre-render left those pages missing from the
 * static export while the links to them stayed, which is a 404 on a page a
 * visitor can reach in two clicks.
 */
export async function getAllPublicPaths(): Promise<{
  lists: Array<{ placeSlug: string; categorySlug: string; modifier: string | null }>
  entities: Array<{ placeSlug: string; categorySlug: string; slug: string }>
}> {
  return safe(async () => {
    const lists = await db
      .select({
        placeSlug: place.slug,
        categorySlug: category.slug,
        modifier: list.modifier,
      })
      .from(list)
      .innerJoin(place, eq(place.id, list.placeId))
      .innerJoin(category, eq(category.id, list.categoryId))
      .where(pilotFilter())

    const entities = await db
      .select({
        placeSlug: place.slug,
        categorySlug: category.slug,
        slug: entity.slug,
      })
      .from(entity)
      .innerJoin(place, eq(place.id, entity.placeId))
      .innerJoin(entityCategory, eq(entityCategory.entityId, entity.id))
      .innerJoin(category, eq(category.id, entityCategory.categoryId))
      .where(and(eq(entity.status, 'published'), eq(entityCategory.isPrimary, true), pilotFilter()))

    return {
      lists: lists.flatMap((l) =>
        l.placeSlug && l.categorySlug
          ? [{ placeSlug: l.placeSlug, categorySlug: l.categorySlug, modifier: l.modifier }]
          : [],
      ),
      entities: entities.flatMap((e) =>
        e.slug && e.placeSlug && e.categorySlug
          ? [{ placeSlug: e.placeSlug, categorySlug: e.categorySlug, slug: e.slug }]
          : [],
      ),
    }
  }, { lists: [], entities: [] })
}
