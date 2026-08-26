import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { openStatus } from '@aividi/core'
import { AiTag } from '@/components/Ai'
import { Seal } from '@/components/Seal'
import { formatPhone } from '@/components/BusinessCard'
import { MapButton, SocialLinks } from '@/components/PlaceLinks'
import { EmbedLoader, InstagramEmbed, normalise } from '@/components/SocialEmbed'
import { type CardData, getArticle, getArticles, getRelatedArticles } from '@/lib/public-queries'
import { buildMeta, seoTitle, SITE_URL } from '@/lib/seo'

export async function generateStaticParams() {
  const articles = await getArticles()
  return articles.map((a) => ({ slug: a.slug }))
}


export const revalidate = 900

/**
 * A ranking article.
 *
 * Structure follows what the four reference articles agree on, in their order:
 * breadcrumb, headline without a year, byline with both dates, contents,
 * comparison table, then one section per business carrying its own superlative
 * — and under each, the atomic facts a model can lift as single claims.
 *
 * Every fact is read from the profile at render time. The editor owns the
 * prose and nothing else, so a price cannot go stale inside a sentence.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const a = await getArticle(slug)
  if (!a) return {}

  return buildMeta({
    // The year belongs in the title for freshness and NOT in the h1 — one
    // durable URL that gets re-dated, never a new post per year.
    title: seoTitle(a.headline),
    description: a.summary,
    path: `/vodic/${a.slug}`,
    type: 'article',
    publishedTime: a.publishedAt ?? a.updatedAt,
    modifiedTime: a.updatedAt,
    index: true,
  })
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [a, related] = await Promise.all([getArticle(slug), getRelatedArticles(slug)])
  if (!a) notFound()

  const url = `${SITE_URL}/vodic/${a.slug}`
  const fmt = (d: Date) =>
    d.toLocaleDateString('mk-MK', { day: 'numeric', month: 'long', year: 'numeric' })

  // The third-party embed script is loaded only if something on this page
  // actually needs it.
  const hasEmbeds = a.entries.some((e) => e.embedUrl && normalise(e.embedUrl))

  return (
    <article className="container article" style={{ maxWidth: 880 }}>
      <nav className="crumbs" aria-label="Патека">
        <Link href="/">Почетна</Link>
        <span>/</span>
        <Link href="/vodic">Водич</Link>
        <span>/</span>
        {a.placeName}
      </nav>

      <h1>{a.headline}</h1>
      <p className="lede">{a.summary}</p>

      {a.coverKey ? (
        <figure className="article-cover">
          <img src={coverSrc(a.coverKey)} alt="" loading="eager" decoding="async" />
          {a.coverCredit ? <figcaption>{a.coverCredit}</figcaption> : null}
        </figure>
      ) : null}

      <div className="byline">
        <span className="byline-dates">
          {a.publishedAt ? (
            <>
              Објавено <time dateTime={a.publishedAt.toISOString()}>{fmt(a.publishedAt)}</time>
              <span className="sep">·</span>
            </>
          ) : null}
          Ажурирано <time dateTime={a.updatedAt.toISOString()}>{fmt(a.updatedAt)}</time>
        </span>
        <span className="byline-basis">
          Врз основа на {a.entries.length} проверени профили во базата
        </span>
      </div>

      {a.intro ? <p className="article-intro">{a.intro}</p> : null}

      {/* ---- contents: every anchor is separately citable ------------------ */}
      <nav className="toc" aria-label="Содржина">
        <b>Во оваа статија</b>
        <ul>
          <li>
            <a href="#sporedba">Брза споредба</a>
          </li>
          {a.entries.map((e) => (
            <li key={e.card.id}>
              <a href={`#${anchor(e.rank)}`}>
                {e.rank}. {e.card.name}
                {e.role ? <span className="muted"> — {e.role}</span> : null}
              </a>
            </li>
          ))}
          {a.faq.length > 0 ? (
            <li>
              <a href="#prasanja">Најчесто поставувани прашања</a>
            </li>
          ) : null}
        </ul>
      </nav>

      {/* ---- the comparison table ------------------------------------------ */}
      <section className="section" id="sporedba">
        <h2>Брза споредба</h2>
        <div className="scroller">
          <table className="compare">
            <thead>
              <tr>
                <th>{a.categoryName}</th>
                <th>Најдобар за</th>
                <th>AIVIDI Score</th>
                <th>Карма</th>
                <th>Цена</th>
                <th>Работно време</th>
              </tr>
            </thead>
            <tbody>
              {a.entries.map((e) => {
                const status = openStatus(e.card.hours)
                return (
                  <tr key={e.card.id}>
                    <th scope="row">
                      <a href={`#${anchor(e.rank)}`}>{e.card.name}</a>
                    </th>
                    <td>{e.role ?? '—'}</td>
                    <td className="num">{e.card.score === null ? '—' : Math.round(e.card.score)}</td>
                    <td className="num">{e.card.karma === null ? '—' : Math.round(e.card.karma)}</td>
                    <td className="num">{price(e.card.priceFrom, e.card.priceTo)}</td>
                    <td>{status.state === 'unknown' ? '—' : status.label}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---- the entries ---------------------------------------------------- */}
      <section className="section">
        <h2>
          {a.entries.length} {a.categoryName.toLowerCase()} во {a.placeName}
        </h2>

        {a.entries.map((e) => {
          const status = openStatus(e.card.hours)
          const href =
            e.card.slug && e.card.placeSlug && e.card.categorySlug
              ? `/${e.card.placeSlug}/${e.card.categorySlug}/${e.card.slug}`
              : null

          return (
            <div className="entry" key={e.card.id} id={anchor(e.rank)}>
              <h3>
                <span className="entry-rank">{e.rank}</span>
                {href ? <Link href={href}>{e.card.name}</Link> : e.card.name}
                {e.role ? <span className="entry-role">{e.role}</span> : null}
              </h3>

              <div className="entry-scores">
                <Seal
                  variant="score"
                  score={e.card.score === null ? null : Math.round(e.card.score)}
                  size={34}
                />
                {e.card.karma !== null ? (
                  <>
                    <Seal variant="karma" score={Math.round(e.card.karma)} size={34} />
                    <AiTag size="sm" />
                  </>
                ) : null}
                {/* Directions ride with the scores: they are the two things a
                    reader acts on, and splitting them cost a whole row. */}
                <MapButton card={e.card} />
                <SocialLinks card={e.card} />
              </div>

              {/* Photographs of the business, in order of how much they show:
                  its own cover, then any photo, then the logo as a last resort.
                  Nothing is invented — a business with no imagery simply has
                  none here, rather than borrowing a stock interior that is a
                  picture of somewhere else. */}
              {e.embedUrl ? (
                <InstagramEmbed url={e.embedUrl} />
              ) : entryPhoto(e.card) ? (
                <figure className="entry-photo">
                  <img
                    src={entryPhoto(e.card)!.src}
                    alt={`${e.card.name}`}
                    loading="lazy"
                    decoding="async"
                  />
                  {entryPhoto(e.card)!.credit ? (
                    <figcaption>{entryPhoto(e.card)!.credit}</figcaption>
                  ) : null}
                </figure>
              ) : e.card.logo ? (
                <div className="entry-logo">
                  <img src={e.card.logo.src} alt={`${e.card.name} — лого`} loading="lazy" />
                </div>
              ) : null}

              {/* Three different things, in the order a reader needs them:
                  what the place IS, what people say about it, and what we make
                  of it. Collapsing them into one paragraph was why the entries
                  read thin next to the Lyon page. */}
              <div className="entry-body">
                {e.card.description ? <p>{e.card.description}</p> : null}
                {e.card.summary ? (
                  <p className="entry-voice">
                    <AiTag size="sm" />
                    <span>{e.card.summary}</span>
                  </p>
                ) : null}
                {e.verdict ? <p className="entry-verdict">{e.verdict}</p> : null}
              </div>

              {/* Atomic facts. Each line is one self-contained, quotable claim. */}
              <ul className="facts">
                {e.card.priceFrom !== null ? (
                  <li>
                    <span aria-hidden="true">🍴</span>
                    {price(e.card.priceFrom, e.card.priceTo)} за главно јадење
                  </li>
                ) : null}
                {e.pick ? (
                  <li>
                    <span aria-hidden="true">⭐</span>
                    Нашиот избор: {e.pick}
                  </li>
                ) : null}
                {status.state !== 'unknown' ? (
                  <li>
                    <span aria-hidden="true">⏰</span>
                    {status.label}
                    {status.detail ? ` · ${status.detail}` : ''}
                  </li>
                ) : null}
                {e.card.phone ? (
                  <li>
                    <span aria-hidden="true">📞</span>
                    <a href={`tel:${e.card.phone}`}>{formatPhone(e.card.phone)}</a>
                  </li>
                ) : null}
                {/* The caveat goes last and is never omitted when we have one:
                    it is the line that makes the four above believable. */}
                {e.warning ? (
                  <li className="warn">
                    <span aria-hidden="true">⚠️</span>
                    {e.warning}
                  </li>
                ) : null}
              </ul>

              {href ? (
                <p className="entry-more">
                  <Link href={href}>Целосен профил на {e.card.name} →</Link>
                </p>
              ) : null}
            </div>
          )
        })}
      </section>

      {a.outro ? (
        <section className="section">
          <p>{a.outro}</p>
        </section>
      ) : null}

      {/* ---- FAQ ------------------------------------------------------------ */}
      {a.faq.length > 0 ? (
        <section className="section" id="prasanja">
          <h2>Најчесто поставувани прашања</h2>
          {a.faq.map((f) => (
            <details className="faq" key={f.question}>
              <summary>{f.question}</summary>
              <p>{f.answer}</p>
            </details>
          ))}
        </section>
      ) : null}

      {/* Internal linking: back up to the ranking this article summarises, out
          to the town, and across to its siblings. */}
      <section className="section related">
        <h2>Продолжи натаму</h2>
        <ul className="related-links">
          <li>
            <Link href={`/${a.placeSlug}/${a.categorySlug}`}>
              Сите {a.categoryName.toLowerCase()} во {a.placeName}
            </Link>
          </li>
          <li>
            <Link href={`/${a.placeSlug}`}>Сè што имаме за {a.placeName}</Link>
          </li>
          {related.map((r) => (
            <li key={r.slug}>
              <Link href={`/vodic/${r.slug}`}>
                {r.headline}
                <span className="muted"> · {r.placeName}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="article-foot">
        Цените и работното време се ориентациони и се читаат од профилите во моментот кога ја
        отвораш страницата. Ако нешто не се совпаѓа,{' '}
        <Link href="/prijavi">пријави исправка</Link>.
      </p>

      {hasEmbeds ? <EmbedLoader /> : null}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema(a, url)) }}
      />
    </article>
  )
}

function anchor(rank: number): string {
  return `br-${rank}`
}

/** The most informative image we hold for a business, or nothing. */
function entryPhoto(card: CardData) {
  return card.cover ?? card.photos[0] ?? null
}

/** Same convention as everywhere else: absolute stays, bare names are ours. */
function coverSrc(key: string): string {
  if (key.startsWith('http')) return key
  if (key.startsWith('covers/') || key.startsWith('uploads/')) return `/${key}`
  return key.startsWith('/') ? key : `/covers/${key}`
}

function price(from: number | null, to: number | null): string {
  if (from === null) return '—'
  const upper = to && to !== from ? `–${to}` : ''
  return `${from}${upper} ден.`
}

/**
 * The graph.
 *
 * Deliberately a @graph of cross-referenced nodes rather than a lone Article:
 * the point of this page for an assistant is not the prose, it is the ranked
 * set of businesses and the facts attached to each. So every entry is emitted
 * as a real LocalBusiness carrying its address, phone and price band, and the
 * ItemList points at those nodes by @id instead of repeating a name.
 *
 * No author node. There is no byline on the page, and schema that claims one
 * would assert something the page does not show — a team page will carry who
 * we are, and Organization already covers the publisher.
 *
 * Nothing here is invented. Coordinates are emitted only where we hold real
 * ones, and no aggregateRating is emitted at all: Karma is our own computed
 * number, not a review average, and dressing it as one would be a lie in the
 * one place a machine cannot check it.
 */
function articleSchema(a: Awaited<ReturnType<typeof getArticle>> & object, url: string) {
  const org = `${SITE_URL}/#organization`
  const site = `${SITE_URL}/#website`

  const businesses = a.entries.map((e) => {
    const c = e.card
    const profile =
      c.slug && c.placeSlug && c.categorySlug
        ? `${SITE_URL}/${c.placeSlug}/${c.categorySlug}/${c.slug}`
        : undefined

    return {
      '@type': 'LocalBusiness',
      '@id': `${url}#b${e.rank}`,
      name: c.name,
      ...(c.description ? { description: c.description } : {}),
      ...(profile ? { url: profile } : {}),
      ...(c.phone ? { telephone: c.phone } : {}),
      ...(c.website ? { sameAs: [c.website] } : {}),
      ...(c.address
        ? {
            address: {
              '@type': 'PostalAddress',
              streetAddress: c.address,
              addressLocality: a.placeName,
              addressCountry: 'MK',
            },
          }
        : {}),
      ...(c.lat !== null && c.lng !== null
        ? { geo: { '@type': 'GeoCoordinates', latitude: c.lat, longitude: c.lng } }
        : {}),
      ...(c.priceFrom !== null
        ? {
            priceRange: `${c.priceFrom}${
              c.priceTo && c.priceTo !== c.priceFrom ? `-${c.priceTo}` : ''
            } MKD`,
          }
        : {}),
    }
  })

  const graph: Record<string, unknown>[] = [
    {
      '@type': 'Organization',
      '@id': org,
      name: 'aividi.mk',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon.svg` },
    },
    {
      '@type': 'WebSite',
      '@id': site,
      url: SITE_URL,
      name: 'aividi.mk',
      inLanguage: 'mk-MK',
      publisher: { '@id': org },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE_URL}/prebaraj?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'WebPage',
      '@id': `${url}#page`,
      url,
      name: a.headline,
      description: a.summary,
      inLanguage: 'mk-MK',
      isPartOf: { '@id': site },
      ...(a.coverKey
        ? {
            primaryImageOfPage: {
              '@type': 'ImageObject',
              url: `${SITE_URL}${coverSrc(a.coverKey)}`,
            },
          }
        : {}),
      breadcrumb: { '@id': `${url}#crumbs` },
      mainEntity: { '@id': `${url}#ranking` },
    },
    {
      '@type': 'Article',
      '@id': `${url}#article`,
      headline: a.headline,
      description: a.summary,
      inLanguage: 'mk-MK',
      datePublished: (a.publishedAt ?? a.updatedAt).toISOString(),
      dateModified: a.updatedAt.toISOString(),
      mainEntityOfPage: { '@id': `${url}#page` },
      isPartOf: { '@id': site },
      publisher: { '@id': org },
      // What the article is actually about, so a model can resolve the topic
      // without parsing the prose.
      about: businesses.map((b) => ({ '@id': b['@id'] })),
      ...(a.coverKey ? { image: `${SITE_URL}${coverSrc(a.coverKey)}` } : {}),
    },
    ...businesses,
    {
      '@type': 'ItemList',
      '@id': `${url}#ranking`,
      name: a.headline,
      numberOfItems: a.entries.length,
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      itemListElement: a.entries.map((e, i) => ({
        '@type': 'ListItem',
        position: e.rank,
        name: e.role ? `${e.card.name} - ${e.role}` : e.card.name,
        item: { '@id': businesses[i]!['@id'] },
      })),
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${url}#crumbs`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Почетна', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Водич', item: `${SITE_URL}/vodic` },
        { '@type': 'ListItem', position: 3, name: a.headline, item: url },
      ],
    },
  ]

  if (a.faq.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      inLanguage: 'mk-MK',
      isPartOf: { '@id': site },
      mainEntity: a.faq.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    })
  }

  return { '@context': 'https://schema.org', '@graph': graph }
}
