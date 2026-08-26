import { describe, expect, it } from 'vitest'
import {
  extractPhones,
  hostOf,
  normalizeMkPhone,
  normalizeName,
  socialHandle,
} from '../src/normalize.js'

describe('normalizeMkPhone', () => {
  it('normalises every way a Macedonian number gets written', () => {
    const expected = '+38970123456'
    for (const input of [
      '070123456',
      '070 123 456',
      '070/123-456',
      '+389 70 123 456',
      '0038970123456',
      '38970123456',
    ]) {
      expect(normalizeMkPhone(input), input).toBe(expected)
    }
  })

  it('handles Strumica landlines', () => {
    expect(normalizeMkPhone('034 333 222')).toBe('+38934333222')
  })

  it('handles Skopje landlines', () => {
    expect(normalizeMkPhone('02 3123 456')).toBe('+38923123456')
  })

  it('rejects foreign and malformed numbers', () => {
    expect(normalizeMkPhone('+385 91 123 4567')).toBeNull()
    expect(normalizeMkPhone('123')).toBeNull()
    expect(normalizeMkPhone('')).toBeNull()
    expect(normalizeMkPhone(null)).toBeNull()
  })
})

describe('extractPhones', () => {
  it('pulls several numbers out of one scraped field', () => {
    expect(extractPhones('070/123-456, 034 333 222')).toEqual([
      '+38970123456',
      '+38934333222',
    ])
  })

  it('deduplicates', () => {
    expect(extractPhones('070123456 / 070 123 456')).toEqual(['+38970123456'])
  })
})

describe('normalizeName', () => {
  it('extracts the trade name from a Central Registry name', () => {
    const n = normalizeName(
      'ДРУШТВО ЗА ПРОИЗВОДСТВО, ТРГОВИЈА И УСЛУГИ ВИА ПИЦА ДООЕЛ Струмица',
    )
    expect(n.trade).toContain('ВИА ПИЦА')
    expect(n.trade).not.toContain('ДООЕЛ')
    expect(n.trade).not.toContain('ДРУШТВО')
    expect(n.legal).toContain('ДРУШТВО')
  })

  it('prefers a quoted trade name when there is one', () => {
    const n = normalizeName('Друштво за угостителство „Кај Мире“ ДООЕЛ Струмица')
    expect(n.trade).toBe('Кај Мире')
  })

  it('leaves a plain trade name untouched', () => {
    const n = normalizeName('Пекара Симит')
    expect(n.trade).toBe('Пекара Симит')
    expect(n.slug).toBe('pekara-simit')
  })

  it('strips Latin legal forms too', () => {
    expect(normalizeName('Via Pizza DOOEL Strumica').trade).toBe('Via Pizza Strumica')
  })
})

describe('hostOf', () => {
  it('normalises hosts', () => {
    expect(hostOf('https://www.Example.mk/kontakt')).toBe('example.mk')
    expect(hostOf('example.mk')).toBe('example.mk')
    expect(hostOf('not a url at all')).toBeNull()
  })
})

describe('socialHandle', () => {
  it('accepts handles and urls', () => {
    expect(socialHandle('viapizza', 'facebook')).toBe('https://facebook.com/viapizza')
    expect(socialHandle('https://www.instagram.com/viapizza/', 'instagram')).toContain(
      'instagram.com/viapizza',
    )
  })
})
