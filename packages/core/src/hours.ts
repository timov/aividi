/**
 * "Отворено сега" - computed in Europe/Skopje, never in the viewer's timezone.
 *
 * This is the single most useful thing on a listing page and the most common
 * reason someone calls a business at all. It is also the field that goes stale
 * fastest, so the UI always shows when it was last checked next to it.
 */

export interface HourRow {
  weekday: number // 1 = Monday ... 7 = Sunday
  opens?: string | null // "08:00"
  closes?: string | null // "22:00"
  closed?: boolean | null
}

export type OpenState = 'open' | 'closing_soon' | 'closed' | 'unknown'

export interface OpenStatus {
  state: OpenState
  /** Ready to render, in Macedonian. */
  label: string
  /** "до 22:00" / "од 08:00" - the detail line under the label. */
  detail: string | null
}

const TZ = 'Europe/Skopje'

/** Local weekday (1-7) and minutes-since-midnight in Skopje. */
export function skopjeNow(now = new Date()): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }

  const weekday = map[get('weekday')] ?? 1
  const hour = Number(get('hour'))
  const minute = Number(get('minute'))

  return { weekday, minutes: (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0) }
}

function toMinutes(time: string | null | undefined): number | null {
  if (!time) return null
  const m = time.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null
  return h * 60 + min
}

const DAY_NAMES = ['', 'понеделник', 'вторник', 'среда', 'четврток', 'петок', 'сабота', 'недела']

export function openStatus(hours: HourRow[], now = new Date()): OpenStatus {
  if (hours.length === 0) {
    return { state: 'unknown', label: 'Нема податок за работно време', detail: null }
  }

  const { weekday, minutes } = skopjeNow(now)
  const today = hours.filter((h) => h.weekday === weekday)

  for (const row of today) {
    if (row.closed) continue
    const opens = toMinutes(row.opens)
    const closes = toMinutes(row.closes)
    if (opens === null || closes === null) continue

    // A closing time before the opening time means it runs past midnight.
    const overnight = closes <= opens
    const isOpen = overnight ? minutes >= opens || minutes < closes : minutes >= opens && minutes < closes

    if (isOpen) {
      const untilRaw = overnight && minutes >= opens ? closes + 1440 : closes
      const left = untilRaw - minutes
      if (left <= 60) {
        return {
          state: 'closing_soon',
          label: 'Наскоро затвора',
          detail: `затвора во ${row.closes}`,
        }
      }
      return { state: 'open', label: 'Отворено сега', detail: `до ${row.closes}` }
    }

    // Not open yet, but opens later today.
    if (!overnight && minutes < opens) {
      return { state: 'closed', label: 'Затворено', detail: `отвора во ${row.opens}` }
    }
  }

  // Find the next day with an opening time.
  for (let step = 1; step <= 7; step++) {
    const day = ((weekday - 1 + step) % 7) + 1
    const next = hours.find((h) => h.weekday === day && !h.closed && h.opens)
    if (next) {
      const when = step === 1 ? 'утре' : DAY_NAMES[day]
      return { state: 'closed', label: 'Затворено', detail: `отвора ${when} во ${next.opens}` }
    }
  }

  return { state: 'closed', label: 'Затворено', detail: null }
}

/** Groups the weekly pattern into "Пон – Пет: 08:00 – 22:00" lines. */
export function weeklySummary(hours: HourRow[]): Array<{ days: string; time: string }> {
  const SHORT = ['', 'Пон', 'Вто', 'Сре', 'Чет', 'Пет', 'Саб', 'Нед']
  const byDay = new Map<number, string>()

  for (let d = 1; d <= 7; d++) {
    const row = hours.find((h) => h.weekday === d)
    if (!row || row.closed) byDay.set(d, 'Затворено')
    else if (row.opens && row.closes) byDay.set(d, `${row.opens} – ${row.closes}`)
    else byDay.set(d, '—')
  }

  const out: Array<{ days: string; time: string }> = []
  let start = 1

  for (let d = 1; d <= 7; d++) {
    const next = byDay.get(d + 1)
    if (d === 7 || next !== byDay.get(d)) {
      const days = start === d ? SHORT[start] : `${SHORT[start]} – ${SHORT[d]}`
      out.push({ days: days ?? '', time: byDay.get(d) ?? '—' })
      start = d + 1
    }
  }

  return out
}

/* -------------------------------------------------------------------------
   opening_hours
   ------------------------------------------------------------------------- */

const DAY_INDEX: Record<string, number> = {
  mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6, su: 7,
}

/**
 * A deliberately partial opening_hours parser: day ranges, day lists, time
 * ranges, "off" and "24/7". Anything more exotic is left unparsed rather than
 * guessed at - a wrong opening time is worse than a missing one, and the raw
 * string stays in the payload for a human to read.
 */
export function parseOpeningHours(spec: string | null | undefined): HourRow[] {
  if (!spec) return []
  const trimmed = spec.trim()
  if (!trimmed) return []

  if (trimmed === '24/7') {
    return Array.from({ length: 7 }, (_, i) => ({
      weekday: i + 1,
      opens: '00:00',
      closes: '23:59',
    }))
  }

  const out: HourRow[] = []
  for (const rule of trimmed.split(';')) {
    const m = rule
      .trim()
      .match(/^([A-Za-z]{2}(?:\s*[-,]\s*[A-Za-z]{2})*)\s+(off|\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})/)
    if (!m) continue

    const [, dayPart, timePart] = m
    if (!dayPart || !timePart) continue

    const days = new Set<number>()
    for (const chunk of dayPart.split(',')) {
      const range = chunk.trim().toLowerCase().split('-')
      const from = DAY_INDEX[(range[0] ?? '').trim()]
      if (from === undefined) continue
      if (range.length === 1) {
        days.add(from)
        continue
      }
      const to = DAY_INDEX[(range[1] ?? '').trim()]
      if (to === undefined) continue
      // Walk from..to with wraparound, capped at a week. A `d !== to + 1`
      // condition looks tidier but silently produces nothing for "Mo-Su",
      // where the end wraps back onto the start.
      let d = from
      for (let step = 0; step < 7; step++) {
        days.add(d)
        if (d === to) break
        d = (d % 7) + 1
      }
    }

    if (timePart.toLowerCase() === 'off') {
      for (const d of days) out.push({ weekday: d, closed: true })
      continue
    }

    const [opens, closes] = timePart.split('-').map((t) => t.trim().padStart(5, '0'))
    for (const d of days) out.push({ weekday: d, opens, closes })
  }

  return out
}
