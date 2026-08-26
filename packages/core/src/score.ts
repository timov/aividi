/**
 * The AIVIDI Score.
 *
 * This is published on the site, and it is the mechanism that makes businesses
 * hand over the data that becomes the moat: every component is something an
 * owner can improve for free by telling us more. Two consequences for the
 * implementation:
 *
 *   - it must be explainable component by component, so every run is stored
 *     in score_run with its parts
 *   - paid tiers must NOT appear anywhere in it. Money buys a labelled
 *     sponsored slot above the list, never a position inside it.
 */

export interface ScoreInput {
  hasPhone: boolean
  hasAddress: boolean
  hasCoordinates: boolean
  hasWebsiteOrSocial: boolean
  hasDescription: boolean
  categoryCount: number
  openingHoursDays: number
  photoCount: number
  /** Services that carry a real price. Weighted hardest - it is the moat. */
  pricedServiceCount: number
  attributeCount: number
  reviewCount: number
  averageRating: number | null
  verifiedAt: Date | null
  claimed: boolean
  now?: Date
}

export interface ScoreResult {
  total: number
  components: Record<string, number>
}

const WEIGHTS = {
  completeness: 30,
  verification: 25,
  services: 15,
  reviews: 15,
  media: 10,
  engagement: 5,
} as const

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

export function computeScore(input: ScoreInput): ScoreResult {
  const now = input.now ?? new Date()

  // --- completeness: the basics a listing is useless without ---------------
  const completenessChecks = [
    input.hasPhone,
    input.hasAddress,
    input.hasCoordinates,
    input.hasWebsiteOrSocial,
    input.hasDescription,
    input.categoryCount > 0,
    input.openingHoursDays >= 5,
    input.attributeCount >= 3,
  ]
  const completeness =
    (completenessChecks.filter(Boolean).length / completenessChecks.length) *
    WEIGHTS.completeness

  // --- verification: decays, because a fact checked in 2024 is a guess now -
  let verification = 0
  if (input.verifiedAt) {
    const days = (now.getTime() - input.verifiedAt.getTime()) / 86_400_000
    if (days <= 90) verification = WEIGHTS.verification
    else if (days >= 540) verification = 0
    else verification = WEIGHTS.verification * (1 - (days - 90) / 450)
  }

  // --- services with prices: nobody else in the country has these ----------
  const services = clamp01(input.pricedServiceCount / 8) * WEIGHTS.services

  // --- reviews: our own only, and volume matters more than a perfect score -
  const volume = clamp01(Math.log10(input.reviewCount + 1) / Math.log10(31))
  const quality = input.averageRating != null ? clamp01((input.averageRating - 2) / 3) : 0.5
  const reviews = volume * quality * WEIGHTS.reviews

  // --- media ---------------------------------------------------------------
  const media = clamp01(input.photoCount / 6) * WEIGHTS.media

  // --- engagement ----------------------------------------------------------
  const engagement = input.claimed ? WEIGHTS.engagement : 0

  const components = {
    completeness: round(completeness),
    verification: round(verification),
    services: round(services),
    reviews: round(reviews),
    media: round(media),
    engagement: round(engagement),
  }

  const total = round(Object.values(components).reduce((a, b) => a + b, 0))

  return { total, components }
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}

/** Human-readable labels for the admin score breakdown. */
export const SCORE_LABELS: Record<keyof typeof WEIGHTS, string> = {
  completeness: 'Комплетност на профилот',
  verification: 'Свежина на проверката',
  services: 'Услуги со цени',
  reviews: 'Оценки',
  media: 'Фотографии',
  engagement: 'Преземен профил',
}

export const SCORE_WEIGHTS = WEIGHTS
