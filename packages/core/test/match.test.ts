import { describe, expect, it } from 'vitest'
import { matchKey } from '../src/translit.js'
import { blockingKeys, haversine, pairKey, scoreMatch } from '../src/match.js'

const base = (name: string, over: Partial<Parameters<typeof scoreMatch>[0]> = {}) => ({
  nameNorm: matchKey(name),
  ...over,
})

describe('scoreMatch', () => {
  it('auto-merges on an identical EMBS', () => {
    const r = scoreMatch(base('Виа Пица', { embs: '7123456' }), base('VIA PIZZA', { embs: '7123456' }))
    expect(r.verdict).toBe('auto')
    expect(r.score).toBe(1)
  })

  it('refuses to merge when two EMBS differ', () => {
    const r = scoreMatch(
      base('Виа Пица', { embs: '7123456' }),
      base('Виа Пица', { embs: '7999999' }),
    )
    expect(r.verdict).toBe('no')
  })

  it('auto-merges the same name and phone across scripts', () => {
    const r = scoreMatch(
      base('Кај Мире', { phoneE164: '+38934333222', lat: 41.4376, lng: 22.6432 }),
      base('Kaj Mire', { phoneE164: '+38934333222', lat: 41.4377, lng: 22.6433 }),
    )
    expect(r.verdict).toBe('auto')
  })

  it('NEVER auto-merges on name alone - every town has four Кафе Бар Сонце', () => {
    const r = scoreMatch(
      base('Кафе Бар Сонце', { lat: 41.4376, lng: 22.6432, placeId: 'p1' }),
      base('Кафе Бар Сонце', { lat: 41.4381, lng: 22.6439, placeId: 'p1' }),
    )
    expect(r.verdict).toBe('review')
    expect(r.features.phoneEqual).toBe(false)
  })

  it('sends a shared phone with different names to review, not to merge', () => {
    const r = scoreMatch(
      base('Автосервис Костов', { phoneE164: '+38970111222' }),
      base('Вулканизер Мики', { phoneE164: '+38970111222' }),
    )
    expect(r.verdict).toBe('review')
  })

  it('penalises entities far apart', () => {
    const near = scoreMatch(
      base('Пекара Симит', { lat: 41.4376, lng: 22.6432 }),
      base('Пекара Симит', { lat: 41.4377, lng: 22.6433 }),
    )
    const far = scoreMatch(
      base('Пекара Симит', { lat: 41.4376, lng: 22.6432 }),
      base('Пекара Симит', { lat: 41.9981, lng: 21.4254 }),
    )
    expect(far.score).toBeLessThan(near.score)
  })

  it('rejects unrelated businesses', () => {
    const r = scoreMatch(base('Адвокат Стоилов'), base('Пицерија Наполи'))
    expect(r.verdict).toBe('no')
  })
})

describe('blockingKeys', () => {
  it('emits keys for every strong identifier', () => {
    const keys = blockingKeys({
      nameNorm: matchKey('Виа Пица'),
      embs: '7123456',
      phoneE164: '+38970123456',
      websiteHost: 'viapica.mk',
      lat: 41.4376,
      lng: 22.6432,
    })
    expect(keys).toContain('embs:7123456')
    expect(keys).toContain('phone:+38970123456')
    expect(keys).toContain('host:viapica.mk')
    expect(keys.some((k) => k.startsWith('geo:'))).toBe(true)
    expect(keys.some((k) => k.startsWith('name:'))).toBe(true)
  })

  it('puts variants of the same name in the same name bucket', () => {
    const a = blockingKeys({ nameNorm: matchKey('Кај Мире') }).find((k) => k.startsWith('name:'))
    const b = blockingKeys({ nameNorm: matchKey('Kaj Mire') }).find((k) => k.startsWith('name:'))
    expect(a).toBe(b)
  })
})

describe('haversine', () => {
  it('measures a short distance in metres', () => {
    // Roughly one block apart in Strumica.
    const d = haversine(41.4376, 22.6432, 41.4385, 22.6445)
    expect(d).toBeGreaterThan(100)
    expect(d).toBeLessThan(200)
  })
})

describe('pairKey', () => {
  it('is order independent', () => {
    expect(pairKey('b', 'a')).toBe(pairKey('a', 'b'))
  })
})

describe('same name, same town', () => {
  it('always reaches review even with nothing else to corroborate', () => {
    // Exactly the case that slipped through: an OSM record with no phone and
    // no coordinates against a hand-collected row with a phone.
    const r = scoreMatch(
      base('Concept Food & Café Bar', { placeId: 'strumica' }),
      base('CONCEPT Food & Cafe Bar', { placeId: 'strumica', phoneE164: '+38970202666' }),
    )
    expect(r.verdict).toBe('review')
  })

  it('still does not auto-merge on a name alone', () => {
    const r = scoreMatch(
      base('Concept Food & Café Bar', { placeId: 'strumica' }),
      base('CONCEPT Food & Cafe Bar', { placeId: 'strumica', phoneE164: '+38970202666' }),
    )
    expect(r.verdict).not.toBe('auto')
  })

  it('does not fire for the same name in a different town', () => {
    const r = scoreMatch(
      base('Порта Клуб', { placeId: 'prilep' }),
      base('Порта Клуб', { placeId: 'skopje' }),
    )
    expect(r.verdict).toBe('no')
  })
})
