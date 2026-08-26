import { getAllPublicPaths, getListPage } from '@/lib/public-queries'
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/og'
import { formatDate } from '@/lib/seo'

export const dynamic = 'force-static'

export async function generateStaticParams() {
  const { lists } = await getAllPublicPaths()
  const seen = new Set<string>()
  return lists.flatMap((l) => {
    const key = `${l.placeSlug}/${l.categorySlug}`
    if (l.modifier !== null || seen.has(key)) return []
    seen.add(key)
    return [{ place: l.placeSlug, category: l.categorySlug }]
  })
}


export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'aividi.mk'
export const runtime = 'nodejs'

export default async function Image({
  params,
}: {
  params: { place: string; category: string }
}) {
  const page = await getListPage(params.place, params.category, null)
  if (!page) {
    return renderOgImage({ eyebrow: 'aividi', title: 'Бизниси во Македонија' })
  }

  const all = [...page.sponsored, ...page.organic]
  const priced = all.filter((c) => c.priceFrom !== null)
  const range =
    priced.length >= 2
      ? ` · цени ${Math.min(...priced.map((c) => c.priceFrom!))}–${Math.max(
          ...priced.map((c) => c.priceTo ?? c.priceFrom!),
        )} ден.`
      : ''

  return renderOgImage({
    eyebrow: page.placeName,
    title: page.title,
    standfirst: `${all.length} проверени${range}`,
    rows: page.organic.slice(0, 3).map((c) => ({ name: c.name, score: c.score })),
    footnote: `Ажурирано ${formatDate(page.updatedAt)}`,
  })
}
