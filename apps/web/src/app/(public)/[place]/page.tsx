import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CategoryCover } from '@/components/Photo'
import { JsonLd } from '@/components/JsonLd'
import { getActivePlaces, getPlace, getPlaceCategories } from '@/lib/public-queries'
import { breadcrumbJsonLd, buildDescription, buildMeta, seoTitle } from '@/lib/seo'

/**
 * Pre-renders every published URL at build time.
 *
 * Required by the static export, which has no server to render an unknown
 * path on demand — but it is also just better for the normal build: these
 * pages are then served from the CDN on first hit instead of being generated
 * during someone's request.
 */
export async function generateStaticParams() {
  const places = await getActivePlaces(500)
  return places.map((p) => ({ place: p.slug }))
}


export const revalidate = 900

export async function generateMetadata({
  params,
}: {
  params: Promise<{ place: string }>
}): Promise<Metadata> {
  const { place: placeSlug } = await params
  const place = await getPlace(placeSlug)
  if (!place) return {}

  const categories = await getPlaceCategories(place.slug)
  const total = categories.reduce((sum, c) => sum + c.n, 0)

  return buildMeta({
    title: seoTitle(`Сите категории бизниси во ${place.nameMk}`),
    description: buildDescription([
      `${total} проверени бизниси во ${place.nameMk} во ${categories.length} категории.`,
      'Работно време, телефони, услуги и цени на едно место.',
    ]),
    path: `/${place.slug}`,
  })
}

export default async function PlacePage({ params }: { params: Promise<{ place: string }> }) {
  const { place: placeSlug } = await params
  const place = await getPlace(placeSlug)
  if (!place) notFound()

  const categories = await getPlaceCategories(place.slug)
  const total = categories.reduce((sum, c) => sum + c.n, 0)

  return (
    <div className="container">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Почетна', url: '/' },
          { name: place.nameMk, url: `/${place.slug}` },
        ])}
      />

      <nav className="crumbs" aria-label="Патека">
        <Link href="/">Почетна</Link>
        <span>/</span>
        {place.nameMk}
      </nav>

      <h1>Бизниси во {place.nameMk}</h1>
      <p className="lede">
        {total > 0
          ? `${total} бизниси во ${categories.length} категории.`
          : `Сè уште собираме податоци за ${place.nameMk}.`}
      </p>

      <form className="search" action="/prebaraj" role="search" style={{ marginTop: 20 }}>
        <input
          type="search"
          name="q"
          placeholder={`Пребарај во ${place.nameMk}`}
          aria-label="Пребарај бизнис"
        />
        <button type="submit">Пребарај</button>
      </form>

      {categories.length > 0 ? (
        <section>
          <h2 style={{ marginTop: 34 }}>Категории</h2>
          <ul className="cards">
            {categories.map((c) => (
              <li key={c.slug} className="card card-cover">
                <CategoryCover slug={c.slug} name={c.name} ratio="16 / 9" />
                <h3>
                  <Link href={`/${place.slug}/${c.slug}`}>{c.name}</Link>
                </h3>
                <p className="card-sub">{c.n} бизниси</p>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="empty-state" style={{ marginTop: 24 }}>
          Нема објавени бизниси за ова место.
        </div>
      )}
    </div>
  )
}
