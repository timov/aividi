import { describe, expect, it } from 'vitest'
import {
  openStatus,
  parseOpeningHours,
  skopjeNow,
  weeklySummary,
  type HourRow,
} from '../src/hours.js'

/**
 * All times below are given as UTC and asserted against Europe/Skopje.
 * 2026-08-24 is in summer time, so Skopje is UTC+2.
 */
const at = (utc: string) => new Date(utc)

const allWeek = (opens: string, closes: string): HourRow[] =>
  Array.from({ length: 7 }, (_, i) => ({ weekday: i + 1, opens, closes }))

describe('skopjeNow', () => {
  it('reads the local hour, not the server hour', () => {
    // 10:00 UTC in August is 12:00 in Skopje.
    const { minutes } = skopjeNow(at('2026-08-24T10:00:00Z'))
    expect(minutes).toBe(12 * 60)
  })
})

describe('openStatus', () => {
  const hours = allWeek('08:00', '22:00')

  it('reports open during business hours', () => {
    const s = openStatus(hours, at('2026-08-24T10:00:00Z')) // 12:00 local
    expect(s.state).toBe('open')
    expect(s.detail).toBe('до 22:00')
  })

  it('warns in the last hour before closing', () => {
    const s = openStatus(hours, at('2026-08-24T19:30:00Z')) // 21:30 local
    expect(s.state).toBe('closing_soon')
    expect(s.detail).toContain('22:00')
  })

  it('reports closed before opening, with the opening time', () => {
    const s = openStatus(hours, at('2026-08-24T04:00:00Z')) // 06:00 local
    expect(s.state).toBe('closed')
    expect(s.detail).toBe('отвора во 08:00')
  })

  it('handles places that close after midnight', () => {
    const late = allWeek('20:00', '02:00')
    expect(openStatus(late, at('2026-08-24T21:00:00Z')).state).toBe('open') // 23:00
    expect(openStatus(late, at('2026-08-24T22:30:00Z')).state).toBe('open') // 00:30
    expect(openStatus(late, at('2026-08-24T14:00:00Z')).state).toBe('closed') // 16:00
  })

  it('says so plainly when there is no data, rather than guessing', () => {
    const s = openStatus([])
    expect(s.state).toBe('unknown')
    expect(s.label).toContain('Нема податок')
  })

  it('skips a day marked closed and points at the next open day', () => {
    const closedToday: HourRow[] = [
      { weekday: 1, closed: true },
      { weekday: 2, opens: '09:00', closes: '17:00' },
      { weekday: 3, opens: '09:00', closes: '17:00' },
      { weekday: 4, opens: '09:00', closes: '17:00' },
      { weekday: 5, opens: '09:00', closes: '17:00' },
      { weekday: 6, opens: '09:00', closes: '14:00' },
      { weekday: 7, closed: true },
    ]
    // 2026-08-24 is a Monday in Skopje.
    const { weekday } = skopjeNow(at('2026-08-24T10:00:00Z'))
    expect(weekday).toBe(1)

    const s = openStatus(closedToday, at('2026-08-24T10:00:00Z'))
    expect(s.state).toBe('closed')
    expect(s.detail).toBe('отвора утре во 09:00')
  })
})

describe('weeklySummary', () => {
  it('collapses identical days into ranges', () => {
    const rows: HourRow[] = [
      ...[1, 2, 3, 4, 5].map((d) => ({ weekday: d, opens: '08:00', closes: '22:00' })),
      { weekday: 6, opens: '09:00', closes: '23:00' },
      { weekday: 7, closed: true },
    ]
    const summary = weeklySummary(rows)
    expect(summary).toEqual([
      { days: 'Пон – Пет', time: '08:00 – 22:00' },
      { days: 'Саб', time: '09:00 – 23:00' },
      { days: 'Нед', time: 'Затворено' },
    ])
  })

  it('marks days with no row at all as closed', () => {
    const summary = weeklySummary([{ weekday: 1, opens: '10:00', closes: '18:00' }])
    expect(summary[0]).toEqual({ days: 'Пон', time: '10:00 – 18:00' })
    expect(summary[1]).toEqual({ days: 'Вто – Нед', time: 'Затворено' })
  })
})

/**
 * parseOpeningHours is used by every source, including the hand-entered CSVs. "Mo-Su" is the most common spec there is
 * and it used to expand to a single day.
 */
describe('parseOpeningHours day ranges', () => {
  it('expands a full-week range to seven days', () => {
    expect(parseOpeningHours('Mo-Su 10:00-23:00')).toHaveLength(7)
  })

  it('expands partial ranges, lists and wraparound', () => {
    expect(parseOpeningHours('Mo-Fr 08:00-16:00')).toHaveLength(5)
    expect(parseOpeningHours('Sa-Su 09:00-14:00')).toHaveLength(2)
    expect(parseOpeningHours('Mo,We,Fr 09:00-17:00')).toHaveLength(3)
    expect(parseOpeningHours('Su-Mo 09:00-17:00')).toHaveLength(2)
    expect(parseOpeningHours('Mo-Th 11:00-23:00; Fr-Sa 11:00-24:00; Su 12:00-23:00')).toHaveLength(7)
  })

  it('still handles 24/7 and unparseable specs', () => {
    expect(parseOpeningHours('24/7')).toHaveLength(7)
    expect(parseOpeningHours('by appointment')).toHaveLength(0)
  })
})
