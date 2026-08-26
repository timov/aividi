import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { hostOf, isModifier, normalizeUrl, openStatus, skopjeNow, weeklySummary } from '@aividi/core'
import { formatPhone } from '@/components/BusinessCard'
import { VerifiedBadge } from '@/components/Brand'
import { Icon } from '@/components/Icon'
import { Photo } from '@/components/Photo'
import { KarmaPanel, ScoreBar, ScorePanel, ScorePlaque } from '@/components/Score'
import { AiTag } from '@/components/Ai'
import { Seal } from '@/components/Seal'
import { JsonLd } from '@/components/JsonLd'
import { ListView } from '@/components/ListView'
import { getEntityPage, getAllPublicPaths, getListPage } from '@/lib/public-queries'
import {
  breadcrumbJsonLd,
  buildDescription,
  buildMeta,
  entityJsonLd,
  listDescriptionClauses,
  seoTitle,
  SITE_URL,
} from '@/lib/seo'

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


export const revalidate = 900

/**
 * The third segment is either a facet modifier (/picerii/dostava) or a
 * business slug (/picerii/pizza-slice). Modifiers are a closed set, so they
 * are checked first and everything else is looked up as an entity.
 */

type Params = Promise<{ place: string; category: string; slug: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { place, category, slug } = await params

  if (isModifier(slug)) {
    const page = await getListPage(place, category, slug)
    if (!page) return {}
    return buildMeta({
      title: seoTitle(page.title),
      description: buildDescription(listDescriptionClauses(page), page.updatedAt),
      path: `/${place}/${category}/${slug}`,
      type: 'article',
      modifiedTime: page.updatedAt,
      index: page.isIndexable,
    })
  }

  const e = await getEntityPage(slug)
  if (!e) return {}

  const priced = e.services.filter((x) => x.from !== null)
  return buildMeta({
    title: `${e.name} — ${e.categoryName ?? ''} во ${e.placeName ?? ''}`.replace(/\s+/g, ' ').trim(),
    description: buildDescription(
      [
        e.description ?? `${e.name}${e.placeName ? ` во ${e.placeName}` : ''}.`,
        e.phone ? `Телефон, адреса и работно време.` : 'Адреса и работно време.',
        priced.length > 0 ? `${priced.length} услуги со цени.` : '',
      ],
      e.verifiedAt ?? undefined,
    ),
    path: `/${place}/${category}/${slug}`,
    type: 'article',
    modifiedTime: e.verifiedAt ?? undefined,
  })
}

export default async function SlugPage({ params }: { params: Params }) {
  const { place, category, slug } = await params

  if (isModifier(slug)) {
    const page = await getListPage(place, category, slug)
    if (!page) notFound()
    return <ListView page={page} basePath={`/${place}/${category}/${slug}`} />
  }

  const e = await getEntityPage(slug)
  if (!e) notFound()

  const status = openStatus(e.hours)
  const week = weeklySummary(e.hours)
  const { weekday } = skopjeNow()
  const url = `${SITE_URL}/${place}/${category}/${slug}`

  // Coordinates only. Falling back to a text search on the address sends
  // people to whatever Google decides that street means, which is how you end
  // up pointing at a field outside town - worse than showing no map at all.
  // hostOf/normalizeUrl tolerate bare domains and malformed values; `new URL`
  // throws, and a bad website field should never 500 a whole profile.
  const websiteHref = normalizeUrl(e.website)
  const websiteLabel = hostOf(e.website) ?? websiteHref

  const mapsUrl =
    e.lat != null && e.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${e.lat},${e.lng}`
      : null

  return (
    <>
      <JsonLd data={entityJsonLd(e, url)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Почетна', url: '/' },
          { name: e.placeName ?? '', url: `/${place}` },
          { name: e.categoryName ?? '', url: `/${place}/${category}` },
          { name: e.name, url: `/${place}/${category}/${slug}` },
        ])}
      />

      {e.cover ? (
        <div className="profile-cover">
          <img src={e.cover.src} alt="" loading="eager" decoding="async" />
        </div>
      ) : null}

      <div className={`profile-top${e.cover ? ' has-cover' : ''}${e.logo ? ' has-logo' : ''}`}>
        <div className="container">
          <nav className="crumbs" aria-label="Патека" style={{ paddingTop: 0 }}>
            <Link href="/">Почетна</Link>
            <span>/</span>
            <Link href={`/${place}`}>{e.placeName}</Link>
            <span>/</span>
            <Link href={`/${place}/${category}`}>{e.categoryName}</Link>
          </nav>

          <div className="profile-id">
            {e.logo ? (
              <div className="profile-logo">
                <img src={e.logo.src} alt={`${e.name} — лого`} decoding="async" />
              </div>
            ) : null}
            <div style={{ minWidth: 0, flex: '1 1 340px' }}>
              <h1>{e.name}</h1>
              <div className="record-meterline">
                {/* Both numbers sit together here on purpose: the whole model
                    is that they answer different questions, and a reader who
                    only ever meets one of them below the fold never learns
                    there are two. */}
                <span className="score-lockup">
                  <Seal
                    variant="score"
                    score={e.score === null ? null : Math.round(e.score)}
                    size={52}
                  />
                  <ScoreBar value={e.score} />
                  <span className="lockup-word">профил</span>
                </span>
                {e.karma !== null ? (
                  <span className="score-lockup karma-inline">
                    <Seal variant="karma" score={Math.round(e.karma)} size={52} />
                    <ScoreBar value={e.karma} tone="karma" />
                    <span className="lockup-word">карма</span>
                    <AiTag size="sm" />
                  </span>
                ) : null}
                <VerifiedBadge verifiedAt={e.verifiedAt} size="lg" />
                <span className={`state ${status.state === 'closing_soon' ? 'open' : status.state}`}>
                  {status.label}
                  {status.detail ? <span className="when">· {status.detail}</span> : null}
                </span>
              </div>
              <p className="muted" style={{ margin: 0 }}>
                {e.categoryName}
                {e.address ? ` · ${e.address}` : ''}
                {e.placeName ? `, ${e.placeName}` : ''}
              </p>
            </div>
            {e.phone ? (
              <a className="call" href={`tel:${e.phone}`}>
                <span className="word">Јави се</span>
                <span>{formatPhone(e.phone)}</span>
              </a>
            ) : null}
          </div>

          <ul className="subnav">
            <li>
              <a href="#pregled" aria-current="true">
                Преглед
              </a>
            </li>
            {e.services.length > 0 ? (
              <li>
                <a href="#uslugi">Услуги и цени</a>
              </li>
            ) : null}
            {week.length > 0 ? (
              <li>
                <a href="#rabotno-vreme">Работно време</a>
              </li>
            ) : null}
            <li>
              <a href="#kontakt">Контакт</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="container">
      <div className="profile-grid">
        <div>
          {e.photos.length > 0 ? (
            <div className="gallery">
              <div className="gallery-lead">
                <Photo
                  photo={e.photos[0]}
                  name={e.name}
                  category={category}
                  ratio="16 / 9"
                  sizes="(min-width: 940px) 700px, 100vw"
                />
              </div>
              {e.photos.length > 1 ? (
                <div className="gallery-strip">
                  {e.photos.slice(1, 5).map((photo) => (
                    <Photo
                      key={photo.src}
                      photo={photo}
                      name={e.name}
                      category={category}
                      ratio="1 / 1"
                      sizes="180px"
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {e.description ? (
            <section className="panel" id="pregled">
              <h2>За бизнисот</h2>
              <p style={{ marginBottom: 0 }}>{e.description}</p>
            </section>
          ) : null}

          {e.summary ? (
            <section className="panel summary-panel">
              <h2>Што велат гостите</h2>
              {/* Labelled honestly: these summaries are written by our team from
                  public opinion, not generated. If that ever changes the label
                  changes with it — the provenance line is the whole point. */}
              <p className="summary-source">
                <span className="summary-mark">
                  <Icon name="sparkle" size={16} />
                </span>
                Резиме од aividi.mk, врз основа на јавно достапни мислења
              </p>
              <p className="summary-body">{e.summary}</p>
              {e.karmaReviews ? (
                <p className="small muted" style={{ margin: 0 }}>
                  Врз основа на {e.karmaReviews} јавни оценки.
                </p>
              ) : null}
            </section>
          ) : null}

          {e.services.length > 0 ? (
            <section className="panel" id="uslugi">
              <h2>Услуги и цени</h2>
              <table className="kv">
                <tbody>
                  {e.services.map((s) => (
                    <tr key={s.name}>
                      <th scope="row">{s.name}</th>
                      <td>
                        {s.from === null
                          ? '—'
                          : s.to && s.to !== s.from
                            ? `${s.from} – ${s.to} ден.`
                            : `${s.from} ден.`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="small muted" style={{ margin: '12px 0 0' }}>
                Цените се ориентациони. Провери со бизнисот пред нарачка.
              </p>
            </section>
          ) : null}

          {week.length > 0 ? (
            <section className="panel" id="rabotno-vreme">
              <h2>Работно време</h2>
              <table className="kv">
                <tbody>
                  {week.map((row, i) => (
                    <tr key={`${row.days}-${i}`} className={isToday(row.days, weekday) ? 'today' : ''}>
                      <th scope="row">{row.days}</th>
                      <td>{row.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          {e.attributes.length > 0 ? (
            <section className="panel">
              <h2>Што нуди</h2>
              <p className="record-facts" style={{ marginBottom: 0 }}>
                {e.attributes.map((a, i) => (
                  <span key={a}>
                    {i > 0 ? <span className="sep">·</span> : null}
                    {a}
                  </span>
                ))}
              </p>
            </section>
          ) : null}
        </div>

        <aside>
          {/* The score panel: a very large number, then the components it came
              from. Trustpilot puts a star distribution here; for a computed
              score the honest equivalent is showing the working. */}
          <ScorePanel score={e.score} components={e.scoreComponents} />

          <KarmaPanel
            karma={e.karma}
            components={e.karmaComponents}
            reviews={e.karmaReviews}
            confidence={e.karmaConfidence}
          />

          <section className="panel" id="kontakt">
            <h2>Контакт</h2>
            <ul className="contact-list">
              {e.phone ? (
                <li>
                  <Icon name="phone" size={20} />
                  <a href={`tel:${e.phone}`}>{formatPhone(e.phone)}</a>
                </li>
              ) : null}
              {e.address ? (
                <li>
                  <Icon name="pin" size={20} />
                  <span>
                    {e.address}
                    {e.placeName ? `, ${e.placeName}` : ''}
                  </span>
                </li>
              ) : null}
              {websiteHref ? (
                <li>
                  <Icon name="globe" size={20} />
                  <a href={websiteHref} rel="nofollow">
                    {websiteLabel}
                  </a>
                </li>
              ) : null}
              {e.facebook ? (
                <li>
                  <Icon name="globe" size={20} />
                  <a href={e.facebook} rel="nofollow">
                    Facebook
                  </a>
                </li>
              ) : null}
            </ul>

            {mapsUrl ? (
              <a
                className="secondary"
                href={mapsUrl}
                rel="nofollow"
                style={{ width: '100%', marginTop: 16 }}
              >
                Прикажи на карта
              </a>
            ) : null}
          </section>

          <div className="factcards">
            <div className="factcard">
              <span className="ic">
                <Icon name="check" size={20} />
              </span>
              <div>
                <b>{e.verifiedAt ? 'Проверено од aividi.mk' : 'Сè уште непроверено'}</b>
                <span>
                  {e.verifiedAt
                    ? `Последна проверка ${e.verifiedAt.toLocaleDateString('mk-MK')}.`
                    : 'Податоците не се потврдени по телефон со бизнисот.'}
                </span>
              </div>
            </div>
            <div className="factcard">
              <span className="ic">
                <Icon name="clock" size={20} />
              </span>
              <div>
                <b>{e.services.length > 0 ? 'Објавени цени' : 'Нема објавени цени'}</b>
                <span>
                  {e.services.length > 0
                    ? `${e.services.length} услуги со ориентациони цени.`
                    : 'Цените ги додаваме кога ќе ги потврдиме со бизнисот.'}
                </span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <ScorePlaque score={e.score} name={e.name} />
          </div>

          <p className="small muted" style={{ marginTop: 14 }}>
            Ова е твој бизнис? <Link href="/za-biznisi">Преземи го профилот</Link> или{' '}
            <Link href="/prijavi">пријави исправка</Link>.
          </p>
        </aside>
      </div>

      {e.phone ? (
        <div className="sticky-call">
          <a className="call" href={`tel:${e.phone}`}>
            <span className="word">Јави се</span>
            <span>{formatPhone(e.phone)}</span>
          </a>
        </div>
      ) : null}
      </div>
    </>
  )
}

/** Highlights the row covering today in the weekly hours table. */
function isToday(days: string, weekday: number): boolean {
  const SHORT = ['', 'Пон', 'Вто', 'Сре', 'Чет', 'Пет', 'Саб', 'Нед']
  const today = SHORT[weekday]
  if (!today) return false
  if (days === today) return true
  const range = days.split(' – ')
  if (range.length !== 2) return false
  const from = SHORT.indexOf(range[0] ?? '')
  const to = SHORT.indexOf(range[1] ?? '')
  return from > 0 && to > 0 && weekday >= from && weekday <= to
}
