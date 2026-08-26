/**
 * Field resolution.
 *
 * entity_field holds every value we have ever been told for a field, tagged
 * with its source. `entity` holds only the winner. This function is the rule
 * that picks it, and it is deliberately boring and pure so it can be argued
 * about in a test rather than in production.
 *
 * The ordering that matters: an owner correcting their own opening hours must
 * beat an OSM node from 2019 without anyone writing a special case.
 */

export interface FieldCandidate<T = string> {
  value: T
  /** source.trust, 0-100. */
  trust: number
  /** 0..1, set by the adapter that produced the value. */
  confidence: number
  verifiedAt: Date | null
  updatedAt: Date
  sourceId: string
  sourceKind?: string
}

export interface ResolvedField<T = string> {
  value: T
  sourceId: string
  effective: number
  verifiedAt: Date | null
}

/** Verification decays over a year and a half, same curve as the score. */
export function verificationFreshness(verifiedAt: Date | null, now = new Date()): number {
  if (!verifiedAt) return 0
  const days = (now.getTime() - verifiedAt.getTime()) / 86_400_000
  if (days <= 90) return 1
  if (days >= 540) return 0
  return 1 - (days - 90) / 450
}

export function effectiveWeight(c: FieldCandidate<unknown>, now = new Date()): number {
  const trust = Math.max(0, Math.min(100, c.trust)) / 100
  const confidence = Math.max(0, Math.min(1, c.confidence))
  return trust * 0.5 + confidence * 0.3 + verificationFreshness(c.verifiedAt, now) * 0.2
}

export function resolveField<T>(
  candidates: FieldCandidate<T>[],
  now = new Date(),
): ResolvedField<T> | null {
  const usable = candidates.filter(
    (c) => c.value !== null && c.value !== undefined && c.value !== ('' as unknown as T),
  )
  if (usable.length === 0) return null

  let best: FieldCandidate<T> | undefined
  let bestWeight = -1

  for (const c of usable) {
    const w = effectiveWeight(c, now)
    if (
      w > bestWeight ||
      (w === bestWeight && best && c.updatedAt.getTime() > best.updatedAt.getTime())
    ) {
      best = c
      bestWeight = w
    }
  }

  if (!best) return null
  return {
    value: best.value,
    sourceId: best.sourceId,
    effective: Math.round(bestWeight * 1000) / 1000,
    verifiedAt: best.verifiedAt,
  }
}
