import { nameSimilarity } from './similarity.js'

/**
 * Entity matching.
 *
 * Two rules encoded here, both learned the hard way by everyone who has built
 * one of these:
 *
 *   1. A name-only match NEVER auto-merges. Every Macedonian town has four
 *      "Кафе Бар Сонце" and they are four different businesses.
 *   2. A strong identifier (EMBS, phone, website host) is what turns a guess
 *      into a merge. Without one, a human decides.
 */

export interface MatchInput {
  id?: string
  /** matchKey() output - the folded, comparable name. */
  nameNorm: string
  embs?: string | null
  phoneE164?: string | null
  phoneAlt?: string[] | null
  websiteHost?: string | null
  lat?: number | null
  lng?: number | null
  placeId?: string | null
  addressNorm?: string | null
}

export type Verdict = 'auto' | 'review' | 'no'

export interface MatchResult {
  score: number
  verdict: Verdict
  features: {
    nameSim: number
    embsEqual: boolean
    phoneEqual: boolean
    websiteEqual: boolean
    samePlace: boolean | null
    addressSim: number | null
    distanceM: number | null
  }
  /** Why it landed where it did - shown to the reviewer in /admin/matches. */
  reason: string
}

/** Metres between two WGS84 points. */
export function haversine(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const lat1 = toRad(aLat)
  const lat2 = toRad(bLat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Cheap keys used to pull a small candidate set out of Postgres before any
 * expensive comparison runs. A record only ever competes with records that
 * share at least one key.
 */
export function blockingKeys(input: MatchInput): string[] {
  const keys: string[] = []
  if (input.embs) keys.push(`embs:${input.embs}`)
  if (input.phoneE164) keys.push(`phone:${input.phoneE164}`)
  for (const p of input.phoneAlt ?? []) keys.push(`phone:${p}`)
  if (input.websiteHost) keys.push(`host:${input.websiteHost}`)

  const head = input.nameNorm.replace(/\s/g, '').slice(0, 4)
  if (head.length >= 3) {
    keys.push(input.placeId ? `name:${head}:${input.placeId}` : `name:${head}`)
  }
  // ~1.1km cells: catches the same shop geocoded slightly differently.
  if (input.lat != null && input.lng != null) {
    keys.push(`geo:${input.lat.toFixed(2)}:${input.lng.toFixed(2)}`)
  }
  return keys
}

const AUTO_THRESHOLD = 0.9
const REVIEW_THRESHOLD = 0.55

export function scoreMatch(a: MatchInput, b: MatchInput): MatchResult {
  const nameSim = nameSimilarity(a.nameNorm, b.nameNorm)

  const embsEqual = Boolean(a.embs && b.embs && a.embs === b.embs)

  const aPhones = new Set([a.phoneE164, ...(a.phoneAlt ?? [])].filter(Boolean) as string[])
  const bPhones = new Set([b.phoneE164, ...(b.phoneAlt ?? [])].filter(Boolean) as string[])
  const phoneEqual = [...aPhones].some((p) => bPhones.has(p))

  const websiteEqual = Boolean(
    a.websiteHost && b.websiteHost && a.websiteHost === b.websiteHost,
  )

  const samePlace =
    a.placeId && b.placeId ? a.placeId === b.placeId : null

  const distanceM =
    a.lat != null && a.lng != null && b.lat != null && b.lng != null
      ? haversine(a.lat, a.lng, b.lat, b.lng)
      : null

  const addressSim =
    a.addressNorm && b.addressNorm ? nameSimilarity(a.addressNorm, b.addressNorm) : null

  const features = {
    nameSim,
    embsEqual,
    phoneEqual,
    websiteEqual,
    samePlace,
    addressSim,
    distanceM,
  }

  // EMBS is the only authoritative identifier in the country. If both sides
  // have one and they agree, nothing else matters.
  if (embsEqual) {
    return { score: 1, verdict: 'auto', features, reason: 'Ист ЕМБС' }
  }
  // ...and if both have one and they differ, they are different legal entities.
  if (a.embs && b.embs && a.embs !== b.embs) {
    return { score: 0, verdict: 'no', features, reason: 'Различен ЕМБС' }
  }

  let score = nameSim * 0.45

  if (phoneEqual) score += 0.35
  if (websiteEqual) score += 0.2

  if (distanceM != null) {
    if (distanceM < 50) score += 0.15
    else if (distanceM < 200) score += 0.1
    else if (distanceM < 1000) score += 0.03
    else if (distanceM > 5000) score -= 0.25
  }

  if (samePlace === true) score += 0.05
  else if (samePlace === false) score -= 0.15

  if (addressSim != null && addressSim > 0.85) score += 0.08

  // An identical folded name in the same settlement always earns a human look,
  // even with nothing else to corroborate it. Without this, "Concept Food &
  // Café Bar" from OSM and "CONCEPT Food & Cafe Bar" from a hand-collected CSV
  // score 0.50 — just under the review threshold — and the duplicate is
  // silently kept. That is the single most common way a directory rots.
  if (nameSim >= 0.95 && samePlace === true) {
    score = Math.max(score, REVIEW_THRESHOLD)
  }

  score = Math.max(0, Math.min(1, score))

  // The guard rail: a strong identifier is required to merge without a human.
  const hasStrongKey = phoneEqual || websiteEqual
  let verdict: Verdict
  let reason: string

  if (score >= AUTO_THRESHOLD && hasStrongKey && nameSim >= 0.75) {
    verdict = 'auto'
    reason = phoneEqual ? 'Ист телефон и слично име' : 'Ист домен и слично име'
  } else if (score >= REVIEW_THRESHOLD) {
    verdict = 'review'
    reason = hasStrongKey
      ? 'Силен клуч, но имињата се разликуваат'
      : 'Слични имиња, без заеднички клуч'
  } else {
    verdict = 'no'
    reason = 'Премала сличност'
  }

  return { score, verdict, features, reason }
}

/** Stable key for a pair, so the same two entities are only queued once. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}
