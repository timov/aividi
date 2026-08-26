/**
 * Scaffolding and refreshing ranking articles.
 *
 * The article is a thin editorial layer over a ranking that already exists.
 * That ordering matters: if an editor typed the businesses, prices and hours
 * by hand, the article would start rotting the moment a profile changed. Here
 * the facts stay in the database and are read at render time, so the only
 * thing that can go stale is the prose — which is the only part a person
 * should be maintaining anyway.
 *
 * Running this twice is safe. Scaffolding fills empty editorial fields and
 * re-syncs the entry list to the current ranking; it never overwrites a
 * sentence somebody wrote.
 */
import {
  and,
  article,
  articleEntry,
  author,
  category,
  db,
  entity,
  eq,
  isNull,
  list,
  listItem,
  notInArray,
  place,
  raw,
} from '@aividi/db'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { slugify } from '@aividi/core'

export interface ScaffoldResult {
  articleId: string
  slug: string
  created: boolean
  entries: number
  removed: number
}

/**
 * The superlative each rank is offered by default.
 *
 * Deliberately generic: a real role names the question the entry wins
 * («најдобра пица», «најдобро за прослави») and only an editor knows that.
 * These are placeholders that read correctly until replaced, and the first is
 * the only one that is true by construction — it IS the top of the ranking.
 */
const DEFAULT_ROLES = [
  'најдобар избор севкупно',
  'најдобар однос цена–квалитет',
  'најдобро за поголемо друштво',
  'најдобро за брз оброк',
  'најдобро за мирна вечер',
]

function roleFor(rank: number): string | null {
  return DEFAULT_ROLES[rank - 1] ?? null
}

interface Cover {
  key: string
  credit: string | null
}

/**
 * Finds apps/web/public by walking up from the working directory.
 *
 * `pnpm ingest` runs with cwd set to apps/worker, so joining onto cwd pointed
 * at apps/worker/apps/web/public and silently produced no cover at all.
 */
function webPublicDir(): string | null {
  if (process.env.WEB_PUBLIC_DIR) return process.env.WEB_PUBLIC_DIR
  let dir = process.cwd()
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, 'apps', 'web', 'public')
    if (existsSync(candidate)) return candidate
    const up = dirname(dir)
    if (up === dir) break
    dir = up
  }
  return null
}

/**
 * The category's own cover art, with the credit line Commons requires.
 *
 * Read from the file the fetcher writes rather than hardcoded, so an article
 * cannot end up crediting the wrong photographer if the image is refetched.
 */
function coverFor(categorySlug: string): Cover | null {
  try {
    const root = webPublicDir()
    if (!root) return null
    const file = join(root, 'covers', `${categorySlug}.jpg`)
    if (!existsSync(file)) return null

    const creditsPath = join(root, 'covers', 'credits.json')
    let credit: string | null = null
    if (existsSync(creditsPath)) {
      const all = JSON.parse(readFileSync(creditsPath, 'utf8')) as Record<
        string,
        { artist?: string; licence?: string }
      >
      const c = all[categorySlug]
      if (c?.artist) credit = `Фото: ${c.artist}${c.licence ? ` · ${c.licence}` : ''}`
    }
    return { key: `covers/${categorySlug}.jpg`, credit }
  } catch {
    return null
  }
}

/** The default byline, created once so Person schema has something to point at. */
export async function ensureAuthor(
  name: string,
  role?: string,
): Promise<string> {
  const slug = slugify(name)
  const [row] = await db
    .insert(author)
    .values({ slug, name, role: role ?? null })
    .onConflictDoUpdate({ target: author.slug, set: { name } })
    .returning({ id: author.id })
  if (!row) throw new Error(`could not upsert author ${slug}`)
  return row.id
}

/**
 * Creates or refreshes the article for one place x category.
 *
 * `limit` caps how many businesses the article covers. Five is the shape the
 * reference articles use — enough to be a real comparison, few enough that
 * every entry can carry its own superlative honestly.
 */
export async function scaffoldArticle(
  placeSlug: string,
  categorySlug: string,
  opts: { limit?: number; authorName?: string } = {},
): Promise<ScaffoldResult> {
  const limit = opts.limit ?? 5

  const [scope] = await db
    .select({
      placeId: place.id,
      placeName: place.nameMk,
      categoryId: category.id,
      categoryName: category.nameMk,
    })
    .from(place)
    .innerJoin(category, eq(category.slug, categorySlug))
    .where(eq(place.slug, placeSlug))
    .limit(1)

  if (!scope) throw new Error(`no such place/category: ${placeSlug}/${categorySlug}`)

  // The ranked list is the source of the ordering. Falling back to the hub
  // list keeps this working before `najdobri` has passed the index gate.
  const [ranked] = await db
    .select({ id: list.id })
    .from(list)
    .where(
      and(
        eq(list.placeId, scope.placeId),
        eq(list.categoryId, scope.categoryId),
        eq(list.modifier, 'najdobri'),
      ),
    )
    .limit(1)

  const [hub] = ranked
    ? []
    : await db
        .select({ id: list.id })
        .from(list)
        .where(
          and(
            eq(list.placeId, scope.placeId),
            eq(list.categoryId, scope.categoryId),
            isNull(list.modifier),
          ),
        )
        .limit(1)

  const source = ranked ?? hub
  if (!source) throw new Error(`no list built yet for ${placeSlug}/${categorySlug} — run lists first`)

  const ranking = await db
    .select({ entityId: listItem.entityId, rank: listItem.rank })
    .from(listItem)
    .innerJoin(entity, eq(entity.id, listItem.entityId))
    .where(and(eq(listItem.listId, source.id), eq(entity.status, 'published')))
    .orderBy(listItem.rank)
    .limit(limit)

  if (ranking.length === 0) throw new Error(`the ranking for ${placeSlug}/${categorySlug} is empty`)

  const slug = `najdobri-${categorySlug}-${placeSlug}`
  const lowerCategory = scope.categoryName.toLowerCase()

  const headline = `Најдобри ${lowerCategory} во ${scope.placeName}`
  const summary =
    `Каде да одиш во ${scope.placeName}? Еве го нашиот избор на ${ranking.length} ` +
    `${lowerCategory} што вредат, со цени, работно време и адреси.`

  // Checked before the upsert: onConflictDoUpdate cannot tell us afterwards
  // whether it inserted or updated, and comparing the returned slug to the one
  // we just built is always true.
  const [existing] = await db
    .select({ id: article.id })
    .from(article)
    .where(and(eq(article.placeId, scope.placeId), eq(article.categoryId, scope.categoryId)))
    .limit(1)

  const authorId = opts.authorName ? await ensureAuthor(opts.authorName, 'Уредник') : null

  // Every article gets a cover, because one without looks unfinished — and the
  // category art is already fetched, credited and licence-checked. Unlike a
  // business profile, an article cover is about a category in a town rather
  // than a claim about one business, so stock is honest here. An editor can
  // replace it with a photograph of the town at any point.
  const cover = coverFor(categorySlug)

  // COALESCE on update, never assignment: a rebuild must not silently replace
  // an editor's headline with the generated one.
  const [row] = await db
    .insert(article)
    .values({
      slug,
      placeId: scope.placeId,
      categoryId: scope.categoryId,
      authorId,
      headline,
      summary,
      coverKey: cover?.key ?? null,
      coverCredit: cover?.credit ?? null,
    })
    .onConflictDoUpdate({
      target: [article.placeId, article.categoryId, article.language],
      set: {
        updatedAt: new Date(),
        // COALESCE, not assignment: a rebuild must not clear a byline an
        // editor set, nor overwrite it when this run passes none.
        authorId: raw`COALESCE(${article.authorId}, ${authorId})`,
        coverKey: raw`COALESCE(${article.coverKey}, ${cover?.key ?? null})`,
        coverCredit: raw`COALESCE(${article.coverCredit}, ${cover?.credit ?? null})`,
      },
    })
    .returning({ id: article.id, slug: article.slug })

  if (!row) throw new Error(`could not upsert article ${slug}`)

  const keep = ranking.map((r) => r.entityId)

  for (const [i, r] of ranking.entries()) {
    await db
      .insert(articleEntry)
      .values({
        articleId: row.id,
        entityId: r.entityId,
        rank: i + 1,
        role: roleFor(i + 1),
      })
      .onConflictDoUpdate({
        target: [articleEntry.articleId, articleEntry.entityId],
        // Rank follows the ranking; the prose belongs to the editor.
        set: { rank: i + 1 },
      })
  }

  // Anything that fell out of the ranking loses its entry, and its prose with
  // it. That is intended: a verdict about a business no longer in the list is
  // worse than no verdict, because nothing on the page would contradict it.
  const removed = await db
    .delete(articleEntry)
    .where(and(eq(articleEntry.articleId, row.id), notInArray(articleEntry.entityId, keep)))
    .returning({ id: articleEntry.id })

  return {
    articleId: row.id,
    slug: row.slug,
    created: !existing,
    entries: ranking.length,
    removed: removed.length,
  }
}
