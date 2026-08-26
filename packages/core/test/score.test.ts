import { describe, expect, it } from 'vitest'
import { computeScore, type ScoreInput } from '../src/score.js'
import { evaluateGate } from '../src/gate.js'
import { resolveField } from '../src/provenance.js'

const empty: ScoreInput = {
  hasPhone: false,
  hasAddress: false,
  hasCoordinates: false,
  hasWebsiteOrSocial: false,
  hasDescription: false,
  categoryCount: 0,
  openingHoursDays: 0,
  photoCount: 0,
  pricedServiceCount: 0,
  attributeCount: 0,
  reviewCount: 0,
  averageRating: null,
  verifiedAt: null,
  claimed: false,
}

const full: ScoreInput = {
  hasPhone: true,
  hasAddress: true,
  hasCoordinates: true,
  hasWebsiteOrSocial: true,
  hasDescription: true,
  categoryCount: 2,
  openingHoursDays: 7,
  photoCount: 12,
  pricedServiceCount: 10,
  attributeCount: 6,
  reviewCount: 30,
  averageRating: 4.7,
  verifiedAt: new Date(),
  claimed: true,
}

describe('computeScore', () => {
  it('gives an empty profile nothing', () => {
    expect(computeScore(empty).total).toBe(0)
  })

  it('gives a complete, verified, priced profile close to 100', () => {
    const r = computeScore(full)
    expect(r.total).toBeGreaterThan(90)
    expect(r.total).toBeLessThanOrEqual(100)
  })

  it('decays verification with age', () => {
    const now = new Date('2026-08-24T00:00:00Z')
    const fresh = computeScore({ ...full, now, verifiedAt: new Date('2026-08-01T00:00:00Z') })
    const stale = computeScore({ ...full, now, verifiedAt: new Date('2025-06-01T00:00:00Z') })
    const ancient = computeScore({ ...full, now, verifiedAt: new Date('2024-01-01T00:00:00Z') })
    expect(fresh.components.verification).toBeGreaterThan(stale.components.verification!)
    expect(ancient.components.verification).toBe(0)
  })

  it('rewards priced services hardest, because they are the moat', () => {
    const withPrices = computeScore({ ...empty, pricedServiceCount: 8 })
    const withPhotos = computeScore({ ...empty, photoCount: 8 })
    expect(withPrices.total).toBeGreaterThan(withPhotos.total)
  })

  it('never lets money buy a point', () => {
    // There is deliberately no tier/subscription input on ScoreInput.
    expect(Object.keys(computeScore(full).components)).not.toContain('sponsored')
  })
})

describe('evaluateGate', () => {
  it('blocks a facet with too few entities', () => {
    const r = evaluateGate({
      qualifyingEntities: 2,
      distinctDimensions: ['ceni'],
      hasDataDrivenIntro: true,
    })
    expect(r.indexable).toBe(false)
  })

  it('blocks a facet that duplicates its parent', () => {
    const r = evaluateGate({
      qualifyingEntities: 9,
      distinctDimensions: [],
      hasDataDrivenIntro: true,
    })
    expect(r.indexable).toBe(false)
  })

  it('blocks a facet with a templated intro', () => {
    const r = evaluateGate({
      qualifyingEntities: 9,
      distinctDimensions: ['ceni'],
      hasDataDrivenIntro: false,
    })
    expect(r.indexable).toBe(false)
  })

  it('opens the gate when all three conditions hold', () => {
    const r = evaluateGate({
      qualifyingEntities: 9,
      distinctDimensions: ['ceni', 'rabotno-vreme'],
      hasDataDrivenIntro: true,
    })
    expect(r.indexable).toBe(true)
  })
})

describe('resolveField', () => {
  const now = new Date('2026-08-24T00:00:00Z')

  it('lets an owner correction beat a stale OSM value', () => {
    const winner = resolveField(
      [
        {
          value: '08:00-16:00',
          trust: 35,
          confidence: 0.5,
          verifiedAt: null,
          updatedAt: new Date('2019-05-01'),
          sourceId: 'osm',
        },
        {
          value: '09:00-21:00',
          trust: 100,
          confidence: 0.95,
          verifiedAt: now,
          updatedAt: now,
          sourceId: 'owner',
        },
      ],
      now,
    )
    expect(winner?.value).toBe('09:00-21:00')
    expect(winner?.sourceId).toBe('owner')
  })

  it('returns null when there is nothing usable', () => {
    expect(resolveField([])).toBeNull()
  })

  it('breaks ties on recency', () => {
    const shared = { trust: 50, confidence: 0.5, verifiedAt: null, sourceId: 's' }
    const winner = resolveField(
      [
        { ...shared, value: 'old', updatedAt: new Date('2026-01-01') },
        { ...shared, value: 'new', updatedAt: new Date('2026-08-01') },
      ],
      now,
    )
    expect(winner?.value).toBe('new')
  })
})
