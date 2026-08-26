import { describe, expect, it } from 'vitest'
import { computeKarma, karmaBand } from '../src/karma.js'

const base = {
  externalRating: null,
  externalCount: null,
  ownRating: null,
  ownCount: 0,
  hasSummary: false,
}

describe('computeKarma', () => {
  it('says nothing when there are no opinions at all', () => {
    const k = computeKarma(base)
    expect(k.total).toBeNull()
    expect(karmaBand(k.total)).toBe('Нема доволно оценки')
  })

  it('scores a rating that has no stated count, at low confidence', () => {
    // The common case in hand-collected data: an average, no volume.
    const k = computeKarma({ ...base, externalRating: 4.7 })
    expect(k.total).not.toBeNull()
    expect(k.confidence).toBe('low')
  })

  it('stretches the useful range — 4.7 is not 94', () => {
    const k = computeKarma({ ...base, externalRating: 4.7, externalCount: 200 })
    // Ratings cluster in the top fifth, so 4.7/5 must not read as near-perfect.
    expect(k.components.rating).toBeLessThan(65)
    expect(k.components.rating).toBeGreaterThan(45)
  })

  it('separates a 3.0 from a 4.8', () => {
    const poor = computeKarma({ ...base, externalRating: 3.0, externalCount: 100 })
    const good = computeKarma({ ...base, externalRating: 4.8, externalCount: 100 })
    expect(good.total!).toBeGreaterThan(poor.total! + 30)
  })

  it('raises confidence with volume, not with the rating', () => {
    expect(computeKarma({ ...base, externalRating: 4.5, externalCount: 5 }).confidence).toBe('low')
    expect(computeKarma({ ...base, externalRating: 4.5, externalCount: 40 }).confidence).toBe('medium')
    expect(computeKarma({ ...base, externalRating: 4.5, externalCount: 500 }).confidence).toBe('high')
    // A perfect score on three opinions is still low confidence.
    expect(computeKarma({ ...base, externalRating: 5, externalCount: 3 }).confidence).toBe('low')
  })

  it('weights our own reviews above someone else’s aggregate', () => {
    const theirs = computeKarma({ ...base, externalRating: 3.0, externalCount: 10 })
    const mixed = computeKarma({
      ...base,
      externalRating: 3.0,
      externalCount: 10,
      ownRating: 5,
      ownCount: 10,
    })
    expect(mixed.total!).toBeGreaterThan(theirs.total!)
  })

  it('never blends into the AIVIDI Score', () => {
    // Karma takes no completeness input at all — that is the whole point.
    expect(Object.keys(computeKarma({ ...base, externalRating: 4 }).components)).toEqual([
      'rating',
      'volume',
      'voice',
    ])
  })
})
