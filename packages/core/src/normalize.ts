import { matchKey, slugify, toLatin } from './translit.js'

/* ==========================================================================
   Business names
   ========================================================================== */

/**
 * Central Registry names are not trade names. A row comes back looking like
 *
 *   ДРУШТВО ЗА ПРОИЗВОДСТВО, ТРГОВИЈА И УСЛУГИ ВИА ПИЦА ДООЕЛ Струмица
 *
 * and the business on the street is called "Виа Пица". Everything before the
 * trade name is boilerplate and everything after it is a legal form plus a
 * city. Strip both, keep the original in entity.legal_name.
 */
const LEADING_BOILERPLATE =
  /^(трговско\s+)?(друштво|претпријатие|установа|здружение)\s+за\s+(производство|трговија|услуги|градежништво|транспорт|угостителство|промет|шпедиција|маркетинг|консалтинг|туризам|сообраќај|и|,|\s)+/i

const LEGAL_FORMS = [
  'дооел',
  'доо',
  'дoo', // same word typed with Latin o's - happens constantly in MK data
  'тп',
  'ад',
  'јтд',
  'кда',
  'кд',
  'дту',
  'тдр',
  'птт',
  'увоз-извоз',
  'увоз извоз',
  'експорт-импорт',
  'export-import',
  'dooel',
  'doo',
  'tp',
  'ad',
  'jtd',
  'kd',
  'ltd',
  'llc',
]

const QUOTE_PAIRS: Array<[string, string]> = [
  ['„', '“'], // „ “
  ['«', '»'], // « »
  ['"', '"'],
  ["'", "'"],
]

export interface NormalizedName {
  /** Best guess at what the business is actually called. */
  trade: string
  /** The full input, untouched. */
  legal: string
  latin: string
  norm: string
  slug: string
}

export function normalizeName(input: string): NormalizedName {
  const legal = input.trim().replace(/\s+/g, ' ')

  // A quoted segment is almost always the trade name - trust it first.
  let trade = ''
  for (const [open, close] of QUOTE_PAIRS) {
    const start = legal.indexOf(open)
    const end = start >= 0 ? legal.indexOf(close, start + 1) : -1
    if (start >= 0 && end > start + 1) {
      trade = legal.slice(start + 1, end).trim()
      break
    }
  }

  if (!trade) {
    let s = legal.replace(LEADING_BOILERPLATE, '').trim()
    // Drop legal forms wherever they appear, as whole words.
    for (const form of LEGAL_FORMS) {
      s = s.replace(new RegExp(`(^|\\s)${escapeRe(form)}(?=\\s|$|,)`, 'gi'), ' ')
    }
    s = s.replace(/[,\s]+$/g, '').replace(/\s+/g, ' ').trim()
    trade = s || legal
  }

  return {
    trade,
    legal,
    latin: toLatin(trade),
    norm: matchKey(trade),
    slug: slugify(trade),
  }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')
}

/* ==========================================================================
   Phone numbers
   ========================================================================== */

/**
 * North Macedonia: country code 389, national significant number always
 * 8 digits. 2 = Skopje, 3x/4x = regional landlines (Strumica is 34),
 * 7x = mobile, 8x = service numbers.
 */
const MK_CC = '389'

export function normalizeMkPhone(input: string | null | undefined): string | null {
  if (!input) return null

  let digits = input.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) digits = digits.slice(1)

  if (digits.startsWith('00' + MK_CC)) digits = digits.slice(2 + MK_CC.length)
  else if (digits.startsWith(MK_CC)) digits = digits.slice(MK_CC.length)
  else if (digits.startsWith('00')) return null // some other country
  if (digits.startsWith('0')) digits = digits.slice(1)

  if (!/^[234789]\d{7}$/.test(digits)) return null
  return `+${MK_CC}${digits}`
}

/**
 * Scraped fields hold things like "070/123-456, 034 333 222".
 *
 * Note what we do NOT split on: "/". In Macedonia it is far more often a
 * separator *inside* one number (070/123-456) than between two, so splitting
 * on it destroys more numbers than it finds. Parts that hold several numbers
 * glued together are recovered by scanning for valid 8-digit runs instead.
 */
export function extractPhones(input: string | null | undefined): string[] {
  if (!input) return []
  const out = new Set<string>()

  for (const part of input.split(/[,;|\n]| или | и /i)) {
    const direct = normalizeMkPhone(part)
    if (direct) {
      out.add(direct)
      continue
    }
    const digits = part.replace(/[^\d+]/g, '')
    for (const m of digits.matchAll(/(?:00389|\+?389)?0?([234789]\d{7})/g)) {
      const n = normalizeMkPhone(m[1])
      if (n) out.add(n)
    }
  }

  return [...out]
}

export function isMobile(e164: string): boolean {
  return /^\+3897\d{7}$/.test(e164)
}

/* ==========================================================================
   Web identities
   ========================================================================== */

export function normalizeUrl(input: string | null | undefined): string | null {
  if (!input) return null
  const raw = input.trim()
  if (!raw) return null
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

export function hostOf(input: string | null | undefined): string | null {
  const url = normalizeUrl(input)
  if (!url) return null
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

/** Facebook and Instagram handles, from a URL or a bare handle. */
export function socialHandle(
  input: string | null | undefined,
  network: 'facebook' | 'instagram',
): string | null {
  if (!input) return null
  const raw = input.trim().replace(/^@/, '')
  if (!raw) return null
  const host = network === 'facebook' ? 'facebook.com' : 'instagram.com'
  if (!raw.includes('/')) return `https://${host}/${raw}`
  const url = normalizeUrl(raw)
  if (!url || !url.includes(host)) return null
  return url.split('?')[0] ?? url
}

/* ==========================================================================
   Addresses
   ========================================================================== */

const STREET_WORDS = /\b(ул\.?|улица|бул\.?|булевар|бр\.?|број|нас\.?|населба)\b/gi

/** Not a parser - just enough folding to compare two address strings. */
export function normalizeAddress(input: string | null | undefined): string | null {
  if (!input) return null
  const s = matchKey(input.replace(STREET_WORDS, ' '))
  return s || null
}
