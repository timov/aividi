import type { Metadata } from 'next'
import { getModifier } from '@aividi/core'
import type { CardData, EntityPage, ListPage } from './public-queries'

/**
 * Structured data, generated from the graph so it can never drift from what
 * the page renders. This is a large part of why a model would cite us rather
 * than paraphrase a map pin: the facts are machine-readable and dated.
 */

export const SITE_URL = process.env.SITE_URL ?? 'https://aividi.mk'

/** The official channels - one place, so the footer and the Organization
 *  schema's `sameAs` can never drift apart. */
export const SOCIAL_LINKS = {
  instagram: 'https://www.instagram.com/aividi_mk/',
  linkedin: 'https://www.linkedin.com/company/aividi-mk',
} as const

/**
 * Whether THIS deployment is allowed to be indexed.
 *
 * A staging copy of a GEO site is not a harmless convenience: the whole thesis
 * is being the one cheap, correct source for a question, and a second crawlable
 * copy on a preview domain splits that against itself. So indexing is opt-in
 * per deployment, and every host that hands out throwaway URLs is refused even
 * if someone sets SITE_URL to it by mistake.
 */
const PREVIEW_HOST = /localhost|127\.0\.0\.1|\.vercel\.app|\.onrender\.com|\.up\.railway\.app|\.fly\.dev|ngrok/i

export function isIndexable(siteUrl: string, override?: string): boolean {
  if (override === '1') return true
  if (override === '0') return false
  return !PREVIEW_HOST.test(siteUrl)
}

export const IS_INDEXABLE = isIndexable(SITE_URL, process.env.SITE_INDEXABLE)

const WEEKDAY_SCHEMA = [
  '',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

export function entityJsonLd(e: EntityPage, url: string): Record<string, unknown> {
  const openingHoursSpecification = e.hours
    .filter((h) => !h.closed && h.opens && h.closes)
    .map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: `https://schema.org/${WEEKDAY_SCHEMA[h.weekday]}`,
      opens: h.opens,
      closes: h.closes,
    }))

  const makesOffer = e.services
    .filter((s) => s.from !== null)
    .map((s) => ({
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', name: s.name },
      priceSpecification: {
        '@type': 'PriceSpecification',
        priceCurrency: 'MKD',
        minPrice: s.from,
        ...(s.to && s.to !== s.from ? { maxPrice: s.to } : {}),
      },
    }))

  const sameAs = [e.website, e.facebook, e.instagram].filter(Boolean)

  return prune({
    '@context': 'https://schema.org',
    '@type': e.schemaType,
    '@id': url,
    name: e.name,
    url,
    description: e.description,
    telephone: e.phone,
    email: e.email,
    address: e.address
      ? {
          '@type': 'PostalAddress',
          streetAddress: e.address,
          addressLocality: e.placeName,
          addressCountry: 'MK',
        }
      : undefined,
    geo:
      e.lat != null && e.lng != null
        ? { '@type': 'GeoCoordinates', latitude: e.lat, longitude: e.lng }
        : undefined,
    areaServed: e.placeName ? { '@type': 'City', name: e.placeName } : undefined,
    openingHoursSpecification: openingHoursSpecification.length ? openingHoursSpecification : undefined,
    makesOffer: makesOffer.length ? makesOffer : undefined,
    sameAs: sameAs.length ? sameAs : undefined,
  })
}

export function listJsonLd(page: ListPage, url: string): Record<string, unknown> {
  // Sponsored slots are excluded from ItemList: the list published to machines
  // is the ranking, and the ranking is not for sale.
  const items = page.organic

  return prune({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': url,
    name: page.title,
    numberOfItems: items.length,
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    itemListElement: items.map((card, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: prune({
        '@type': 'LocalBusiness',
        name: card.name,
        url:
          card.slug && card.placeSlug && card.categorySlug
            ? `${SITE_URL}/${card.placeSlug}/${card.categorySlug}/${card.slug}`
            : undefined,
        telephone: card.phone,
        address: card.address
          ? {
              '@type': 'PostalAddress',
              streetAddress: card.address,
              addressLocality: card.placeName,
              addressCountry: 'MK',
            }
          : undefined,
      }),
    })),
  })
}

export function breadcrumbJsonLd(trail: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: `${SITE_URL}${c.url}`,
    })),
  }
}

/**
 * The answer block: 40-60 words of plain, extractable prose built from real
 * counts and real fields. If a fact is missing the clause is dropped rather
 * than filled with a guess - that is the difference between this and the
 * generated filler that gets directories removed from search results.
 */
export function answerText(page: ListPage): string {
  const all = [...page.sponsored, ...page.organic]
  const total = all.length
  if (total === 0) return ''

  const named = page.organic
    .slice(0, 3)
    .map((c) => c.name)
    .join(', ')

  const parts: string[] = []
  parts.push(
    `Во ${page.placeName} имаме ${total} ${total === 1 ? 'запишан бизнис' : 'запишани бизниси'} во категоријата ${page.categoryName.toLowerCase()}.`,
  )
  if (named) parts.push(`Меѓу нив се ${named}.`)

  const withPrices = all.filter((c) => c.priceFrom !== null)
  if (withPrices.length >= 2) {
    const min = Math.min(...withPrices.map((c) => c.priceFrom!))
    const max = Math.max(...withPrices.map((c) => c.priceTo ?? c.priceFrom!))
    parts.push(`Цените се движат од ${min} до ${max} денари.`)
  }

  const openNow = all.filter((c) => c.hours.length > 0).length
  if (openNow > 0) parts.push(`За ${openNow} од нив имаме работно време.`)

  return parts.join(' ')
}

export function priceRange(cards: CardData[]): { min: number; max: number } | null {
  const withPrices = cards.filter((c) => c.priceFrom !== null)
  if (withPrices.length === 0) return null
  return {
    min: Math.min(...withPrices.map((c) => c.priceFrom!)),
    max: Math.max(...withPrices.map((c) => c.priceTo ?? c.priceFrom!)),
  }
}

/** Drops undefined keys so the emitted JSON-LD has no empty properties. */
function prune(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue
    out[k] = v
  }
  return out
}


/* ==========================================================================
   Head metadata
   --------------------------------------------------------------------------
   Three audiences read these tags and they want different things:

   Google wants a title under ~60 characters that matches the query, and a
   description it may or may not use.

   An LLM checking whether a page is current lifts the description almost
   verbatim, so it carries the counts and the update date rather than a
   marketing sentence. The year in the title does the same job — it is the
   cheapest freshness signal there is, and it is checked.

   And in Macedonia the link itself mostly travels through Viber, Messenger
   and WhatsApp. Without Open Graph tags every share is a grey stub, which is
   the difference between a link that spreads and one that does not.
   ========================================================================== */

export const SITE_NAME = 'aividi.mk'
export const LOCALE = 'mk_MK'

/** Titles: 50–60 characters. Descriptions: 150–160. */
export const TITLE_MAX = 60
export const DESCRIPTION_MAX = 160
export const DESCRIPTION_MIN = 150

/** Cuts at a word boundary and adds an ellipsis only if something was lost. */
export function truncateAtWord(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:·\-]$/, '')}…`
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('mk-MK', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Graduated versions of the same closing sentence. The longest one that still
 * fits gets appended, which is how a thin page reaches the 150-character band
 * without anyone padding it by hand.
 */
const PADDING = [
  'Секој профил носи AIVIDI Score што покажува колку се проверени податоците.',
  'Секој профил со AIVIDI Score за проверени и ажурирани податоци.',
  'Секој профил со AIVIDI Score за проверени податоци.',
  'Секој профил со AIVIDI Score.',
]

/**
 * Assembles a description from whole clauses. Never cuts a sentence in half —
 * a plain slice does, and a description that ends mid-word reads as broken in
 * a search result and gets rewritten by Google rather than used.
 */
export function buildDescription(clauses: string[], updatedAt?: Date): string {
  const tail = updatedAt ? ` Ажурирано ${formatDate(updatedAt)}.` : ''
  const parts = clauses.filter(Boolean)

  // Greedy fill rather than stop-at-first-miss: one long clause that does not
  // fit should not block a shorter one behind it.
  let out = ''
  for (const clause of parts) {
    const next = out ? `${out} ${clause}` : clause
    if (next.length + tail.length > DESCRIPTION_MAX) continue
    out = next
  }
  if (!out && parts[0]) out = truncateAtWord(parts[0], DESCRIPTION_MAX - tail.length)

  // Top up toward DESCRIPTION_MIN if there is room left.
  if (out.length + tail.length < DESCRIPTION_MIN) {
    const fits = PADDING.find(
      (candidate) => out.length + 1 + candidate.length + tail.length <= DESCRIPTION_MAX,
    )
    if (fits && !out.includes('AIVIDI Score')) out = `${out} ${fits}`
  }

  return `${out}${tail}`
}

export interface MetaInput {
  title: string
  description: string
  /** Path only, e.g. "/strumica/picerii". Canonical and og:url are built from it. */
  path: string
  type?: 'website' | 'article'
  /** Set when the page has no generated opengraph-image of its own. */
  image?: string
  index?: boolean
  publishedTime?: Date
  modifiedTime?: Date
}

/**
 * One place that builds canonical, Open Graph and Twitter tags together, so a
 * page can never end up with a canonical and an og:url that disagree.
 */
export function buildMeta(input: MetaInput): Metadata {
  const url = `${SITE_URL}${input.path}`
  const title = truncateAtWord(input.title, TITLE_MAX)
  const description = truncateAtWord(input.description, DESCRIPTION_MAX)

  return {
    // Absolute, so the layout's "| aividi.mk" template does not eat into the
    // character budget we just spent on the year and the place name.
    title: { absolute: title },
    description,
    alternates: { canonical: input.path },
    robots:
      input.index === false ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: LOCALE,
      type: input.type ?? 'website',
      ...(input.image ? { images: [{ url: input.image, width: 1200, height: 630 }] } : {}),
      ...(input.type === 'article' && (input.publishedTime || input.modifiedTime)
        ? {
            publishedTime: input.publishedTime?.toISOString(),
            modifiedTime: input.modifiedTime?.toISOString(),
          }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(input.image ? { images: [input.image] } : {}),
    },
  }
}

/**
 * "Најдобри пицерии во Струмица (2026)"
 *
 * The year is part of the title and deliberately absent from the H1: repeating
 * it on the page adds nothing for a reader, while in the title it is the
 * freshness signal both Google and an LLM check first.
 */
export function seoTitle(base: string, year = new Date().getFullYear()): string {
  const withYear = `${base} (${year})`
  return withYear.length <= TITLE_MAX ? withYear : truncateAtWord(base, TITLE_MAX)
}

/** The clauses a list page's description is built from, longest-lived first. */
export function listDescriptionClauses(page: ListPage): string[] {
  const all = [...page.sponsored, ...page.organic]
  const priced = all.filter((c) => c.priceFrom !== null)
  const open = all.filter((c) => c.hours.length > 0)

  // A facet and its parent must not share a description: near-identical meta
  // across two URLs is how a site teaches Google they are the same page. The
  // modifier's own lead-in is what makes them differ.
  const modifier = page.modifier ? getModifier(page.modifier) : null
  const lead = modifier
    ? `${modifier.lead(page.categoryName, page.placeName)} — ${all.length} проверени.`
    : `${all.length} ${page.categoryName.toLowerCase()} во ${page.placeName} — адреси, телефони и работно време.`

  const clauses = [lead]
  if (priced.length >= 2) {
    const min = Math.min(...priced.map((c) => c.priceFrom!))
    const max = Math.max(...priced.map((c) => c.priceTo ?? c.priceFrom!))
    clauses.push(`Цени од ${min} до ${max} ден.`)
  }
  if (open.length > 0) clauses.push(`Работно време за ${open.length} од нив.`)
  return clauses
}
