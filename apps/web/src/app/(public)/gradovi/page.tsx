import Link from 'next/link'
import type { Metadata } from 'next'
import { PlaceCover } from '@/components/Photo'
import { getActivePlaces, getSiteStats } from '@/lib/public-queries'
import { buildDescription, buildMeta, seoTitle } from '@/lib/seo'

export const revalidate = 900

export async function generateMetadata(): Promise<Metadata> {
  const stats = await getSiteStats()
  return buildMeta({
    title: seoTitle('Градови во Македонија'),
    description: buildDescription([
      `Бизниси во ${stats.towns} градови во Македонија со работно време, телефони и цени.`,
      'Избери град за да ги видиш сите категории и профили.',
    ]),
    path: '/gradovi',
  })
}

export default async function TownsPage() {
  const places = await getActivePlaces(200)
  const total = places.reduce((sum, p) => sum + p.n, 0)

  return (
    <div className="container">
      <nav className="crumbs" aria-label="Патека">
        <Link href="/">Почетна</Link>
        <span>/</span>Градови
      </nav>

      <h1>Градови</h1>
      <p className="lede">
        {total} бизниси во {places.length}{' '}
        {places.length === 1 ? 'град' : 'градови'}. Листата расте како што внесуваме нови
        податоци.
      </p>

      {places.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 26 }}>
          Сè уште нема објавени бизниси.
        </div>
      ) : (
        <ul className="cards" style={{ marginTop: 28 }}>
          {places.map((p) => (
            <li key={p.slug} className="card card-cover">
              <Link href={`/${p.slug}`}>
                <PlaceCover slug={p.slug} name={p.nameMk} ratio="16 / 9" />
              </Link>
              <h3>
                <Link href={`/${p.slug}`}>{p.nameMk}</Link>
              </h3>
              <p className="card-sub">{p.n} бизниси</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
