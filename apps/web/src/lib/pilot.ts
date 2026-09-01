/**
 * Which towns the public site actually shows.
 *
 * Comma-separated place slugs in PILOT_PLACE_SLUG - "strumica" now, later
 * "strumica,skopje" as more towns go live one at a time. Empty or unset means
 * every town with published content shows, which is the eventual full-launch
 * state: nothing here needs to change to go multi-city, just the env var.
 */
const raw = process.env.PILOT_PLACE_SLUG?.trim()

export const PILOT_PLACES: string[] | null = raw
  ? raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : null

export function isPilotPlace(slug: string | null | undefined): boolean {
  if (!PILOT_PLACES) return true
  return slug != null && PILOT_PLACES.includes(slug)
}
