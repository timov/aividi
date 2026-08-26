import type { HourRow } from './hours.js'

/**
 * Opening hours written the way a person writes them.
 *
 *   "Од понеделник до четврток работи од 08:00 до 24:00. Во петок и сабота
 *    останува отворено до 01:00. Во недела отвора во 09:00."
 *
 * Nobody collecting data by hand is going to type OSM syntax, and asking them
 * to would guarantee mistakes. This reads the sentences instead.
 *
 * The hard part is inheritance: "останува отворено до 01:00" gives a closing
 * time and expects the opening time from the sentence before it, and "отвора
 * во 09:00" does the reverse. So the parser carries the last stated pair
 * forward and fills whichever half a sentence leaves out.
 *
 * Anything it cannot read confidently produces no row at all. A missing
 * opening time is a gap; a wrong one sends somebody to a locked door.
 */

const DAYS: Array<[test: RegExp, weekday: number]> = [
  [/понеделник/i, 1],
  [/вторник/i, 2],
  [/сред[аеу]/i, 3],
  [/четврток/i, 4],
  [/петок/i, 5],
  [/сабот[аиу]/i, 6],
  [/недел[аиу]/i, 7],
]

const TIME = /(\d{1,2}[:.]\d{2})/g
/** "од … до …" as a frame around day names. Whitespace-anchored, not . */
const RANGE_FRAME = /(?:^|\s)од\s[^.]*\sдо\s/i
/** "работи до 15:00" / "останува отворено до 01:00" — a closing time. */
const CLOSING_ONLY = /(?:^|\s)до\s+\d/i
const CLOSED = /затворен/i
const EVERY_DAY = /секој\s+ден|сите\s+денови/i

function normaliseTime(raw: string): string {
  const [h = '0', m = '00'] = raw.replace('.', ':').split(':')
  return `${h.padStart(2, '0')}:${m}`
}

/** Which weekdays a sentence is about. */
function daysIn(sentence: string): number[] {
  if (EVERY_DAY.test(sentence)) return [1, 2, 3, 4, 5, 6, 7]

  const mentioned = DAYS.filter(([test]) => test.test(sentence)).map(([, day]) => day)
  if (mentioned.length === 0) return []

  // "Од понеделник до петок" is a range; "во петок и сабота" is a list. The
  // difference is the "од … до …" frame, not the number of days named.
  //
  // Note RANGE_FRAME anchors on whitespace rather than \b: JavaScript's word
  // boundary is ASCII-only, so /\bод\b/ never matches Cyrillic and silently
  // turned every range into a two-day list.
  const isRange = RANGE_FRAME.test(sentence) && mentioned.length === 2
  if (!isRange) return mentioned

  const [rawFrom, rawTo] = mentioned
  // Order comes from the sentence, not from the weekday numbers, so that
  // "од сабота до понеделник" wraps rather than producing nothing.
  const positions = DAYS.map(([test, day]) => ({ day, at: sentence.search(test) }))
      .filter((d) => d.at >= 0)
      .sort((a, b) => a.at - b.at)
  const from = positions[0]?.day ?? rawFrom ?? 1
  const to = positions[1]?.day ?? rawTo ?? 7

  const out: number[] = []
  let day = from
  for (let step = 0; step < 7; step++) {
    out.push(day)
    if (day === to) break
    day = (day % 7) + 1
  }
  return out
}

export function parseMacedonianHours(text: string | null | undefined): HourRow[] {
  if (!text) return []
  // A "we don't know" note is not opening hours.
  if (/не е наведено|не се наведени|нема податок/i.test(text)) return []

  const byDay = new Map<number, HourRow>()
  let lastOpens: string | null = null
  let lastCloses: string | null = null

  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    const trimmed = sentence.trim()
    if (!trimmed) continue

    const days = daysIn(trimmed)
    if (days.length === 0) continue

    if (CLOSED.test(trimmed)) {
      for (const day of days) byDay.set(day, { weekday: day, closed: true })
      continue
    }

    const times = [...trimmed.matchAll(TIME)].map((m) => normaliseTime(m[1] ?? ''))
    let opens: string | null = null
    let closes: string | null = null

    if (times.length >= 2) {
      opens = times[0] ?? null
      closes = times[1] ?? null
    } else if (times.length === 1) {
      const only = times[0] ?? null
      // "останува отворено до 01:00" / "работи до 15:00" state a closing time
      // and inherit the opening; "отвора во 09:00" states the opening.
      if (CLOSING_ONLY.test(trimmed)) {
        closes = only
        opens = lastOpens
      } else {
        opens = only
        closes = lastCloses
      }
    }

    if (!opens || !closes) continue

    for (const day of days) byDay.set(day, { weekday: day, opens, closes })
    lastOpens = opens
    lastCloses = closes
  }

  return [...byDay.values()].sort((a, b) => a.weekday - b.weekday)
}
