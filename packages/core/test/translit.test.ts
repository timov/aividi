import { describe, expect, it } from 'vitest'
import { matchKey, slugify, toLatin } from '../src/translit.js'

describe('toLatin', () => {
  it('romanises the Macedonian alphabet', () => {
    expect(toLatin('Струмица')).toBe('strumica')
    expect(toLatin('Ѓорѓи')).toBe('gjorgji')
    expect(toLatin('Њива')).toBe('njiva')
    expect(toLatin('Џунгла')).toBe('dzhungla')
    expect(toLatin('Ѕвезда')).toBe('dzvezda')
    expect(toLatin('Ќерамидница')).toBe('kjeramidnica')
  })

  it('leaves Latin input alone apart from case', () => {
    expect(toLatin('Via Pizza')).toBe('via pizza')
  })
})

describe('matchKey', () => {
  it('folds the same business written four different ways', () => {
    const variants = ['Кај Мире', 'Kaj Mire', 'KAJ MIRE', 'Kaj  Mirè']
    const keys = variants.map(matchKey)
    expect(new Set(keys).size).toBe(1)
  })

  it('folds Cyrillic and Latin digraphs together', () => {
    expect(matchKey('Шара')).toBe(matchKey('Shara'))
    expect(matchKey('Шара')).toBe(matchKey('Šara'))
    expect(matchKey('Чичо')).toBe(matchKey('Chicho'))
    expect(matchKey('Жаба')).toBe(matchKey('Zhaba'))
  })

  it('collapses doubled letters', () => {
    expect(matchKey('Kafee')).toBe(matchKey('Kafe'))
  })

  it('strips punctuation and extra spacing', () => {
    expect(matchKey('  Пица-Виа, ДООЕЛ ')).toBe(matchKey('Pica Via DOOEL'))
  })
})

describe('slugify', () => {
  it('produces url-safe latin slugs', () => {
    expect(slugify('Стоматолог Д-р Петров')).toBe('stomatolog-d-r-petrov')
    expect(slugify('Ресторан "Македонска Куќа"')).toBe('restoran-makedonska-kukja')
  })

  it('never leaves leading or trailing dashes', () => {
    expect(slugify('  ...Виа...  ')).toBe('via')
  })
})
