import { isModifier } from '@aividi/core'
import { getEntityPage, getAllPublicPaths, getListPage } from '@/lib/public-queries'
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/og'
import { formatDate } from '@/lib/seo'

export const dynamic = 'force-static'

export async function generateStaticParams() {
  const { lists, entities } = await getAllPublicPaths()
  const seen = new Set<string>()
  const out: Array<{ place: string; category: string; slug: string }> = []

  const push = (place: string, category: string, slug: string) => {
    const key = `${place}/${category}/${slug}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({ place, category, slug })
  }

  // This segment serves two different things: a business profile, and a facet
  // page like /najdobri or /ceni. Pre-rendering only the businesses left every
  // ranked list 404ing in the static export while still being linked to.
  for (const e of entities) push(e.placeSlug, e.categorySlug, e.slug)
  for (const l of lists) {
    if (l.modifier) push(l.placeSlug, l.categorySlug, l.modifier)
  }

  return out
}


export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'aividi.mk'
export const runtime = 'nodejs'

export default async function Image({
  params,
}: {
  params: { place: string; category: string; slug: string }
}) {
  // The third segment is either a facet or a business, same as the page.
  if (isModifier(params.slug)) {
    const page = await getListPage(params.place, params.category, params.slug)
    if (page) {
      const all = [...page.sponsored, ...page.organic]
      return renderOgImage({
        eyebrow: page.placeName,
        title: page.title,
        standfirst: `${all.length} проверени`,
        rows: page.organic.slice(0, 3).map((c) => ({ name: c.name, score: c.score })),
        footnote: `Ажурирано ${formatDate(page.updatedAt)}`,
      })
    }
  }

  const e = await getEntityPage(params.slug)
  if (!e) return renderOgImage({ eyebrow: 'aividi', title: 'Бизниси во Македонија' })

  const priced = e.services.filter((s) => s.from !== null)
  const bits = [
    e.categoryName,
    e.placeName,
    priced.length > 0 ? `${priced.length} услуги со цени` : null,
  ].filter(Boolean)

  return renderOgImage({
    eyebrow: 'Профил на бизнис',
    title: e.name,
    standfirst: bits.join(' · '),
    rows: [{ name: 'AIVIDI Score', score: e.score }],
    footnote: e.verifiedAt
      ? `Проверено ${formatDate(e.verifiedAt)}`
      : 'Податоците сè уште не се потврдени од бизнисот',
  })
}
