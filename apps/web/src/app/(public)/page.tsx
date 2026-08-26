import Link from 'next/link'
import { BusinessCard } from '@/components/BusinessCard'
import { AiTag } from '@/components/Ai'
import { RotatingHeadline } from '@/components/RotatingHeadline'
import { SearchBar } from '@/components/SearchBar'
import { Seal } from '@/components/Seal'
import { Icon, hasIcon } from '@/components/Icon'
import {
  countPublished,
  getListPage,
  getActivePlaces,
  getPlaceCategories,
  getRecentlyVerified,
  getArticles,
  getSiteStats,
  getTopScored,
} from '@/lib/public-queries'

import type { Metadata } from 'next'
import { buildDescription, buildMeta, seoTitle } from '@/lib/seo'

export const revalidate = 900

export async function generateMetadata(): Promise<Metadata> {
  const [stats, places] = await Promise.all([getSiteStats(), getActivePlaces(3)])
  const towns = places.map((p) => p.nameMk).join(', ')

  return buildMeta({
    title: seoTitle('Водич низ бизнисите во Македонија'),
    description: buildDescription([
      `${stats.businesses} бизниси во ${stats.towns} градови: што работат, колку чинат, кога се отворени и што велат луѓето.`,
      towns ? `Најмногу во ${towns}.` : '',
    ]),
    path: '/',
  })
}

export default async function HomePage() {
  // The busiest town leads; everything else is listed. Nothing is hardcoded to
  // Strumica any more — a new town appears as soon as it has published data.
  const places = await getActivePlaces()
  const primary = places[0]
  const slug = primary?.slug ?? 'strumica'
  const categories = primary ? await getPlaceCategories(slug) : []
  const total = await countPublished()

  // One featured list, rendered the way "Best in Bank" is on Trustpilot.
  const featured = categories[0] ? await getListPage(slug, categories[0].slug, null) : null
  const featuredCards = featured ? [...featured.sponsored, ...featured.organic].slice(0, 4) : []
  const [stats, topScored, recentlyVerified, articles] = await Promise.all([
    getSiteStats(),
    getTopScored(4),
    getRecentlyVerified(3),
    getArticles(),
  ])
  const featuredArticle = articles[0] ?? null

  return (
    <>
      <section className="hero">
        <span className="hero-shape s1" aria-hidden="true" />
        <span className="hero-shape s2" aria-hidden="true" />
        <span className="hero-shape s3" aria-hidden="true" />
        <span className="hero-shape s4" aria-hidden="true" />

        <div className="container">
          <RotatingHeadline />
          <p className="lede">
            Прашај како што би прашал пријател.
          </p>

          <SearchBar />

          {total > 0 ? (
            <p className="hero-note">
              {total} бизниси · две оценки за секој: колку е комплетен профилот и што велат
              луѓето
            </p>
          ) : null}
        </div>
      </section>

      {/* The newest article, full-bleed, straight under the hero. It is the
          one thing on this page that shows what the data is FOR rather than
          how much of it there is. */}
      {featuredArticle ? (
        <section className="featured">
          <Link href={`/vodic/${featuredArticle.slug}`} className="featured-link">
            {featuredArticle.coverKey ? (
              <img
                className="featured-img"
                src={featuredArticle.coverKey.startsWith('http') ? featuredArticle.coverKey : `/${featuredArticle.coverKey}`}
                alt=""
                loading="lazy"
                decoding="async"
              />
            ) : null}
            <div className="featured-body">
              <div className="container">
                <span className="featured-tag">Нов избор</span>
                <h2>{featuredArticle.headline}</h2>
                <p>{featuredArticle.summary}</p>
                <span className="featured-meta">
                  {featuredArticle.count} бизниси · ажурирано{' '}
                  {featuredArticle.updatedAt.toLocaleDateString('mk-MK', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>
          </Link>
        </section>
      ) : null}

      {stats.businesses > 0 ? (
        <section className="section" style={{ paddingBottom: 0 }}>
          <div className="container">
            <ul className="stats">
              {(
                [
                  ['building', stats.businesses, 'бизниси во базата'],
                  ['pin', stats.towns, 'градови'],
                  ['grid', stats.categories, 'категории'],
                  ['phone', stats.verified, 'проверени по телефон'],
                  ['tag', stats.priced, 'со објавени цени'],
                ] as const
              ).map(([icon, value, label]) => (
                <li key={label}>
                  <span className="stat-ic" aria-hidden="true">
                    <Icon name={icon} size={22} />
                  </span>
                  <span className="v">{value}</span>
                  <span className="k">{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {categories.length > 0 ? (
        <section className="section">
          <div className="container">
            <div className="section-head">
              <h2>Што бараш во {primary?.nameMk ?? 'Македонија'}?</h2>
              <Link className="secondary" href={`/${slug}`}>
                Сите категории
              </Link>
            </div>
            <ul className="iconrow">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={`/${slug}/${c.slug}`}>
                    {hasIcon(c.slug) ? <Icon name={c.slug} /> : <Icon name="pin" />}
                    <span>{c.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : (
        <section className="section">
          <div className="container">
            <div className="empty-state">
              <p>
                <strong>Сè уште нема објавени бизниси.</strong>
              </p>
              <p className="small" style={{ margin: 0 }}>
                Внеси податоци со <code>pnpm ingest run osm</code>, објави ги во админот, па
                изгради ги листите со <code>pnpm ingest lists</code>.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="badge-strip">
            <div className="badge-art">
              <Seal variant="score" score={84} size={62} />
              <Seal variant="karma" score={91} size={62} />
              <Seal variant="verified" size={62} />
            </div>
            <div>
              <h2>Две оценки, не една</h2>
              <p>
                <strong>AIVIDI Score</strong> кажува колку е комплетен и колку е свеж
                профилот — бизнисот може да го подигне сам, бесплатно.{' '}
                <strong>Карма</strong> кажува што велат луѓето што биле таму: модел за анализа
                на сентимент го чита целиот јавен разговор околу бизнисот и го дестилира во
                еден број. Тоа не го контролираме ни ние, ни тие. Зелениот знак значи дека
                човек се јавил и потврдил. Ништо од ова не се купува.
              </p>
              <p className="badge-ai">
                <AiTag size="md" />
              </p>
            </div>
            <Link className="secondary" href="/za-biznisi">
              Како работи
            </Link>
          </div>
        </div>
      </section>

      <section style={{ paddingBottom: 46 }}>
        <div className="container">
          <div className="promo">
            <div>
              <h2>Имаш бизнис во Македонија?</h2>
              <p>
                Преземи го профилот, дополни ги податоците и подигни го својот AIVIDI Score —
                бесплатно.
              </p>
            </div>
            <Link className="btn-dark" href="/za-biznisi">
              Преземи го профилот
            </Link>
          </div>
        </div>
      </section>

      {featured && featuredCards.length > 0 ? (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="section-head">
              <h2>Најдобри — {featured.categoryName.toLowerCase()}</h2>
              <Link className="secondary" href={`/${slug}/${featured.categorySlug}/najdobri`}>
                Види ја листата
              </Link>
            </div>
            <ul className="records">
              {featuredCards.map((card) => (
                <BusinessCard key={card.id} card={card} showSponsorTag />
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {places.length > 1 ? (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="section-head">
              <h2>Места</h2>
              <span className="muted small">{places.length} со објавени бизниси</span>
            </div>
            <ul className="chips">
              {places.map((p) => (
                <li key={p.slug}>
                  <Link href={`/${p.slug}`}>
                    {p.nameMk} <span className="chip-n">{p.n}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {topScored.length > 0 ? (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="section-head">
              <h2>Најкомплетни профили</h2>
              <span className="muted small">Подредени по AIVIDI Score</span>
            </div>
            <ul className="records">
              {topScored.map((card) => (
                <BusinessCard key={card.id} card={card} />
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="section" style={{ background: 'var(--cream)' }}>
        <div className="container">
          <div className="section-head">
            <h2>Како ја одржуваме базата</h2>
          </div>
          <ol className="steps">
            <li>
              <h3>Собираме</h3>
              <p>
                Од отворени извори и од терен — секој податок си го носи изворот со себе,
                па секогаш се знае од каде дошол.
              </p>
            </li>
            <li>
              <h3>Проверуваме</h3>
              <p>
                Се јавуваме на бизнисот и потврдуваме работно време, услуги и цени.
                Проверката има датум и старее — затоа профилите се одржуваат.
              </p>
            </li>
            <li>
              <h3>Рангираме</h3>
              <p>
                AIVIDI Score го одредува редоследот. Формулата е јавна и секој бизнис може
                да го подигне бесплатно.
              </p>
            </li>
          </ol>
        </div>
      </section>

      {recentlyVerified.length > 0 ? (
        <section className="section">
          <div className="container">
            <div className="section-head">
              <h2>Неодамна проверени</h2>
              <Link className="secondary" href={`/${slug}`}>
                Сите бизниси
              </Link>
            </div>
            <ul className="records">
              {recentlyVerified.map((card) => (
                <BusinessCard key={card.id} card={card} />
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </>
  )
}
