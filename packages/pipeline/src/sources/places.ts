import type { FetchResult, NormalizedRecord, SourceAdapter } from './types.js'

/**
 * Google Places - DISCOVERY ONLY.
 *
 * Read this before extending the file.
 *
 * The Places terms restrict caching of Places content and prohibit using it to
 * build a competing directory. Ratings, review text, photos and descriptions
 * from Places must never become our database - that is exactly the use the
 * terms exclude, and building the moat on it would put the whole project on
 * someone else's permission.
 *
 * So this adapter does one narrow thing: it tells us a business EXISTS and
 * where roughly to look. We persist the place_id and the name we searched
 * with, nothing else, and then go verify the business ourselves by phone.
 * The allowlist below is enforced in code, not by convention, so a later
 * "just add the rating, it's useful" change has to be deliberate.
 */

const ALLOWED_FIELDS = ['place_id', 'name', 'formatted_address', 'geometry'] as const

interface PlacesTextSearchResponse {
  results?: Array<Record<string, unknown>>
  status?: string
  error_message?: string
}

/** Hard filter: anything not on the allowlist never reaches the database. */
export function stripToAllowedFields(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of ALLOWED_FIELDS) {
    if (raw[key] !== undefined) out[key] = raw[key]
  }
  return out
}

interface PlacesConfig {
  /** e.g. ["стоматолог Струмица", "автосервис Струмица"] */
  queries?: string[]
  language?: string
}

export const placesAdapter: SourceAdapter = {
  async fetch(config, limit) {
    const key = process.env.GOOGLE_PLACES_API_KEY
    if (!key) throw new Error('GOOGLE_PLACES_API_KEY is not set')

    const cfg = config as unknown as PlacesConfig
    const queries = cfg.queries ?? []
    if (queries.length === 0) throw new Error('places source needs config.queries')

    const out: FetchResult[] = []

    for (const query of queries) {
      const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
      url.searchParams.set('query', query)
      url.searchParams.set('language', cfg.language ?? 'mk')
      url.searchParams.set('key', key)

      const res = await fetch(url)
      if (!res.ok) throw new Error(`Places ${res.status}`)

      const json = (await res.json()) as PlacesTextSearchResponse
      if (json.status && json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
        throw new Error(`Places ${json.status}: ${json.error_message ?? ''}`)
      }

      for (const result of json.results ?? []) {
        const placeId = result.place_id
        if (typeof placeId !== 'string') continue
        out.push({
          externalId: placeId,
          payload: { ...stripToAllowedFields(result), __query: query },
        })
        if (limit && out.length >= limit) return out
      }
    }

    return out
  },

  normalize(payload) {
    const name = payload.name
    if (typeof name !== 'string' || !name) return null

    const geometry = payload.geometry as
      | { location?: { lat?: number; lng?: number } }
      | undefined

    return {
      externalId: String(payload.place_id ?? name),
      name,
      // No phone, no website, no hours, no rating: a pointer, not a record.
      // Everything else on this business gets collected by us, by phone.
      phones: [],
      lat: geometry?.location?.lat ?? null,
      lng: geometry?.location?.lng ?? null,
      address:
        typeof payload.formatted_address === 'string' ? payload.formatted_address : null,
      placeSlug: null,
      categorySlugs: [],
      attributeSlugs: [],
      hours: [],
    } satisfies NormalizedRecord
  },
}
