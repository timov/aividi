/**
 * КАРМА — what people think.
 *
 * Deliberately a second, separate number from the AIVIDI Score, because they
 * answer different questions and a business needs to be able to move them
 * independently:
 *
 *   AIVIDI Score   how good is this RECORD — complete, checked, priced.
 *                  Fully in the business's control. Free to raise.
 *
 *   Карма          how good is this BUSINESS, according to the people who
 *                  went there. Not in our control and not in theirs.
 *
 * Collapsing them would be the dishonest move: a spotless profile for a bad
 * restaurant would inherit undeserved credibility, and a beloved kafana with a
 * thin profile would look worse than it is.
 *
 * Karma is computed from aggregates, never from anybody else's review text.
 * The inputs are numbers — a rating, a count, our own reviews — and the page
 * always says where they came from.
 */

export interface KarmaInput {
  /** Aggregate rating observed elsewhere, on its own scale. */
  externalRating: number | null
  externalScale?: number
  externalCount: number | null
  /** Reviews people left with us. */
  ownRating: number | null
  ownCount: number
  /** Whether we have written a summary of what customers consistently say. */
  hasSummary: boolean
}

export interface KarmaResult {
  /** 0–100, or null when there is not enough to say anything honest. */
  total: number | null
  components: Record<string, number>
  /** How much evidence sits behind it: thin ratings should not look certain. */
  confidence: 'low' | 'medium' | 'high'
  reviews: number
}

export const KARMA_WEIGHTS = {
  rating: 70,
  volume: 20,
  voice: 10,
} as const

export const KARMA_LABELS: Record<keyof typeof KARMA_WEIGHTS, string> = {
  rating: 'Просечна оценка',
  volume: 'Број на оценки',
  voice: 'Резиме на мислењата',
}

const BANDS: Array<[min: number, label: string]> = [
  [85, 'Одлична'],
  [70, 'Многу добра'],
  [55, 'Добра'],
  [40, 'Просечна'],
  [0, 'Слаба'],
]

export function karmaBand(total: number | null): string {
  if (total === null) return 'Нема доволно оценки'
  return BANDS.find(([min]) => total >= min)?.[1] ?? 'Слаба'
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

export function computeKarma(input: KarmaInput): KarmaResult {
  const scale = input.externalScale ?? 5
  const externalCount = input.externalCount ?? 0
  const reviews = externalCount + input.ownCount

  // A rating with no stated count is still a rating. Sources often publish the
  // average without the volume, and refusing to score those would throw away
  // most of what we actually collect — so it counts as one opinion and the
  // confidence stays low, which is what the reader needs to know anyway.
  const externalWeight = input.externalRating !== null ? Math.max(externalCount, 1) : 0
  const ownWeight = input.ownCount * 2

  if (input.externalRating === null && input.ownRating === null) {
    return { total: null, components: {}, confidence: 'low', reviews: 0 }
  }

  const weightedTotal = externalWeight + ownWeight
  const externalPart =
    input.externalRating !== null ? (input.externalRating / scale) * externalWeight : 0
  const ownPart = input.ownRating !== null ? (input.ownRating / 5) * ownWeight : 0
  const blended = weightedTotal > 0 ? (externalPart + ownPart) / weightedTotal : 0

  // A 4.6 is not 92%. Ratings cluster hard in the top fifth of the scale, so
  // the useful range is stretched: 3.0 of 5 lands near zero, 5.0 near full.
  const stretched = clamp01((blended - 0.6) / 0.4)

  // Volume on a log curve — thirty opinions say much more than three, three
  // hundred say only a little more than thirty.
  const volume = clamp01(Math.log10(reviews + 1) / Math.log10(301))

  const components = {
    rating: round(stretched * KARMA_WEIGHTS.rating),
    volume: round(volume * KARMA_WEIGHTS.volume),
    voice: input.hasSummary ? KARMA_WEIGHTS.voice : 0,
  }

  const confidence: KarmaResult['confidence'] =
    reviews >= 100 ? 'high' : reviews >= 15 ? 'medium' : 'low'

  return {
    total: round(Object.values(components).reduce((a, b) => a + b, 0)),
    components,
    confidence,
    reviews,
  }
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}
