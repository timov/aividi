import { describe, expect, it } from 'vitest'
import { parseMacedonianHours as parse } from '../src/hours-mk.js'

/** Every string below is verbatim from a real hand-collected CSV. */
describe('parseMacedonianHours', () => {
  it('reads a range, a weekend override and a Sunday opening', () => {
    const rows = parse(
      'Од понеделник до четврток работи од 08:00 до 24:00. Во петок и сабота останува ' +
        'отворено до 01:00. Во недела отвора во 09:00.',
    )
    expect(rows).toHaveLength(7)
    expect(rows[0]).toEqual({ weekday: 1, opens: '08:00', closes: '24:00' })
    // "останува отворено до 01:00" inherits Monday–Thursday's opening time.
    expect(rows[4]).toEqual({ weekday: 5, opens: '08:00', closes: '01:00' })
    expect(rows[5]).toEqual({ weekday: 6, opens: '08:00', closes: '01:00' })
    // "отвора во 09:00" inherits the previous sentence's closing time.
    expect(rows[6]).toEqual({ weekday: 7, opens: '09:00', closes: '01:00' })
  })

  it('reads "секој ден"', () => {
    const rows = parse('Работи секој ден од 09:00 до 23:30.')
    expect(rows).toHaveLength(7)
    expect(rows[3]).toEqual({ weekday: 4, opens: '09:00', closes: '23:30' })
  })

  it('marks closed days as closed rather than omitting them', () => {
    const rows = parse(
      'Од понеделник до петок работи од 10:00 до 24:00. Во сабота отвора во 09:00. ' +
        'Во недела е затворено.',
    )
    expect(rows.find((r) => r.weekday === 7)).toEqual({ weekday: 7, closed: true })
    expect(rows.find((r) => r.weekday === 6)?.opens).toBe('09:00')
  })

  it('handles a closed day stated first', () => {
    const rows = parse(
      'Во понеделник е затворено. Од вторник до четврток работи од 08:00 до 24:00. ' +
        'Во петок и сабота останува отворено до 01:00. Во недела работи од 08:00 до 24:00.',
    )
    expect(rows.find((r) => r.weekday === 1)?.closed).toBe(true)
    expect(rows.find((r) => r.weekday === 2)?.opens).toBe('08:00')
    expect(rows.find((r) => r.weekday === 5)?.closes).toBe('01:00')
    expect(rows.find((r) => r.weekday === 7)?.closes).toBe('24:00')
  })

  it('handles a weekend-only range', () => {
    const rows = parse(
      'Во понеделник е затворено. Од вторник до четврток работи од 13:00 до 23:00. ' +
        'Од петок до недела останува отворено до 24:00.',
    )
    expect(rows.find((r) => r.weekday === 5)).toEqual({
      weekday: 5,
      opens: '13:00',
      closes: '24:00',
    })
    expect(rows.find((r) => r.weekday === 7)?.closes).toBe('24:00')
  })

  it('returns nothing when the source says the hours are unknown', () => {
    expect(
      parse('Работното време не е наведено на Гугл, па препорачливо е да се јави претходно.'),
    ).toEqual([])
    expect(parse('')).toEqual([])
    expect(parse(null)).toEqual([])
  })

  it('reads a Sunday with both times stated', () => {
    const rows = parse(
      'Од понеделник до сабота работи од 08:00 до 01:00. Во недела отвора во 09:00 и работи до 01:00.',
    )
    expect(rows).toHaveLength(7)
    expect(rows[6]).toEqual({ weekday: 7, opens: '09:00', closes: '01:00' })
  })
})
