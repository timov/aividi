import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ListView } from '@/components/ListView'
import { getAllPublicPaths, getListPage } from '@/lib/public-queries'
import { buildDescription, buildMeta, listDescriptionClauses, seoTitle } from '@/lib/seo'

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


export const revalidate = 900

export async function generateMetadata({
  params,
}: {
  params: Promise<{ place: string; category: string }>
}): Promise<Metadata> {
  const { place, category } = await params
  const page = await getListPage(place, category, null)
  if (!page) return {}

  return buildMeta({
    title: seoTitle(
      `${page.title} — ${page.sponsored.length + page.organic.length} проверени`,
    ),
    description: buildDescription(listDescriptionClauses(page), page.updatedAt),
    path: `/${place}/${category}`,
    type: 'article',
    modifiedTime: page.updatedAt,
    // The index gate, enforced where it is visible to crawlers.
    index: page.isIndexable,
  })
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ place: string; category: string }>
}) {
  const { place, category } = await params
  const page = await getListPage(place, category, null)
  if (!page) notFound()

  return <ListView page={page} basePath={`/${place}/${category}`} />
}
