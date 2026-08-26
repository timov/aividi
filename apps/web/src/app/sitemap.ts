import type { MetadataRoute } from 'next'
import { getActivePlaces, getArticles, getIndexableUrls } from '@/lib/public-queries'
import { SITE_URL } from '@/lib/seo'

export const revalidate = 3600

/**
 * Only pages that cleared the index gate go in here.
 *
 * A sitemap full of thin facets is how a directory teaches a crawler that its
 * URLs are not worth fetching. `lastmod` is the real updated_at from the graph,
 * never "now" - a sitemap that claims everything changed today gets its dates
 * ignored entirely.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const places = await getActivePlaces(200)
  const { lists, entities } = await getIndexableUrls()
  const articles = await getArticles()

  const entries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/prijavi`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/vodic`, changeFrequency: 'weekly', priority: 0.6 },
  ]

  // Articles carry a real lastmod and rank above the lists they summarise:
  // they are the page a person is most likely to want to land on.
  for (const a of articles) {
    entries.push({
      url: `${SITE_URL}/vodic/${a.slug}`,
      lastModified: a.updatedAt,
      changeFrequency: 'monthly',
      priority: 0.8,
    })
  }

  for (const place of places) {
    entries.push({
      url: `${SITE_URL}/${place.slug}`,
      changeFrequency: 'daily',
      priority: 0.9,
    })
  }

  for (const l of lists) {
    entries.push({
      url: l.modifier
        ? `${SITE_URL}/${l.placeSlug}/${l.categorySlug}/${l.modifier}`
        : `${SITE_URL}/${l.placeSlug}/${l.categorySlug}`,
      lastModified: l.updatedAt,
      changeFrequency: 'weekly',
      priority: l.modifier ? 0.6 : 0.8,
    })
  }

  for (const e of entities) {
    if (!e.slug || !e.placeSlug || !e.categorySlug) continue
    entries.push({
      url: `${SITE_URL}/${e.placeSlug}/${e.categorySlug}/${e.slug}`,
      lastModified: e.updatedAt,
      changeFrequency: 'weekly',
      priority: 0.7,
    })
  }

  return entries
}
