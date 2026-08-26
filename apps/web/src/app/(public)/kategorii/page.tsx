import Link from 'next/link'
import type { Metadata } from 'next'
import { CategoryCover } from '@/components/Photo'
import { getAllCategories, getSiteStats } from '@/lib/public-queries'
import { buildDescription, buildMeta, seoTitle } from '@/lib/seo'

export const revalidate = 900

export async function generateMetadata(): Promise<Metadata> {
  const stats = await getSiteStats()
  return buildMeta({
    title: seoTitle('Сите категории бизниси'),
    description: buildDescription([
      `${stats.categories} категории бизниси низ Македонија — ресторани, пицерии, кафулиња, мајстори и услуги.`,
      'Секој профил со работно време, телефон и AIVIDI Score.',
    ]),
    path: '/kategorii',
  })
}

export default async function CategoriesPage() {
  const categories = await getAllCategories()

  return (
    <div className="container">
      <nav className="crumbs" aria-label="Патека">
        <Link href="/">Почетна</Link>
        <span>/</span>Категории
      </nav>

      <h1>Категории</h1>
      <p className="lede">
        {categories.length} категории со објавени бизниси. Секоја води до листа по град.
      </p>

      <ul className="cards" style={{ marginTop: 28 }}>
        {categories.map((c) => (
          <li key={c.slug} className="card card-cover">
            <CategoryCover slug={c.slug} name={c.name} ratio="16 / 9" />
            <h3>
              <Link href={`/${c.topPlaceSlug}/${c.slug}`}>{c.name}</Link>
            </h3>
            <p className="card-sub">
              {c.n} бизниси · најмногу во {c.topPlaceName}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
