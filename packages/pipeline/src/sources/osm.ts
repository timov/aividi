import { extractPhones, normalizeName, parseOpeningHours, socialHandle } from '@aividi/core'
import type { FetchResult, NormalizedRecord, SourceAdapter } from './types.js'

/**
 * OpenStreetMap via Overpass.
 *
 * Licence: ODbL 1.0. Share-alike can attach to a derived database, so every
 * value from here keeps its own source_id - we must always be able to answer
 * "which fields came from OSM", and attribute it on pages that show them.
 */

const OVERPASS = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter'

const POI_KEYS = ['amenity', 'shop', 'craft', 'office', 'healthcare', 'tourism', 'leisure']

function buildQuery(area: string): string {
  const clauses = POI_KEYS.map((k) => `  nwr(area.a)["${k}"]["name"];`).join('\n')
  return `[out:json][timeout:120];
area["name"="${area}"]["boundary"="administrative"]->.a;
(
${clauses}
);
out center tags;`
}

interface OverpassElement {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

/* -------------------------------------------------------------------------
   OSM tag -> our category taxonomy
   ------------------------------------------------------------------------- */

const CATEGORY_RULES: Array<[key: string, value: string, slug: string]> = [
  ['amenity', 'restaurant', 'restorani'],
  ['amenity', 'fast_food', 'brza-hrana'],
  ['cuisine', 'pizza', 'picerii'],
  ['cuisine', 'burger', 'brza-hrana'],
  ['amenity', 'cafe', 'kafulinja'],
  ['amenity', 'bar', 'kafulinja'],
  ['amenity', 'pub', 'kafulinja'],
  ['amenity', 'dentist', 'stomatolozi'],
  ['healthcare', 'dentist', 'stomatolozi'],
  ['shop', 'car_repair', 'avtoservisi'],
  ['shop', 'tyres', 'avtoservisi'],
  ['craft', 'plumber', 'majstori'],
  ['craft', 'electrician', 'majstori'],
  ['craft', 'carpenter', 'majstori'],
  ['craft', 'builder', 'majstori'],
  ['craft', 'painter', 'majstori'],
  ['shop', 'hairdresser', 'saloni-za-ubavina'],
  ['shop', 'beauty', 'saloni-za-ubavina'],
  ['office', 'estate_agent', 'nedvizhnini'],
  ['tourism', 'hotel', 'smestuvanje'],
  ['tourism', 'guest_house', 'smestuvanje'],
  ['tourism', 'apartment', 'smestuvanje'],
  ['tourism', 'motel', 'smestuvanje'],
  ['amenity', 'events_venue', 'svadbi-i-nastani'],
  ['amenity', 'conference_centre', 'svadbi-i-nastani'],
  ['office', 'lawyer', 'advokati-i-smetkovodstvo'],
  ['office', 'accountant', 'advokati-i-smetkovodstvo'],
  ['shop', 'supermarket', 'prodavnici'],
  ['shop', 'convenience', 'prodavnici'],
  ['shop', 'general', 'prodavnici'],
  ['shop', 'bakery', 'prodavnici'],
]

const ATTRIBUTE_RULES: Array<[key: string, value: string | true, slug: string]> = [
  ['wheelchair', 'yes', 'pristap-invalidi'],
  ['outdoor_seating', 'yes', 'terasa'],
  ['internet_access', 'wlan', 'wifi'],
  ['delivery', 'yes', 'dostava'],
  ['payment:cards', 'yes', 'kartichki'],
  ['payment:visa', 'yes', 'kartichki'],
  ['takeaway', 'yes', 'dostava'],
]

/* ------------------------------------------------------------------------- */

export const osmAdapter: SourceAdapter = {
  async fetch(config, limit) {
    const area = String(config.area ?? 'Струмица')
    const res = await fetch(OVERPASS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'aividi.mk ingestion (contact: hello@aividi.mk)',
      },
      body: new URLSearchParams({ data: buildQuery(area) }),
    })

    if (!res.ok) {
      throw new Error(`Overpass ${res.status}: ${(await res.text()).slice(0, 300)}`)
    }

    const json = (await res.json()) as { elements?: OverpassElement[] }
    const elements = (json.elements ?? []).filter((e) => e.tags?.name)
    const sliced = limit ? elements.slice(0, limit) : elements

    return sliced.map<FetchResult>((e) => ({
      externalId: `${e.type}/${e.id}`,
      payload: e as unknown as Record<string, unknown>,
    }))
  },

  normalize(payload) {
    const el = payload as unknown as OverpassElement
    const tags = el.tags ?? {}
    const name = tags.name
    if (!name) return null

    const categorySlugs = new Set<string>()
    for (const [k, v, slug] of CATEGORY_RULES) {
      if (tags[k] === v) categorySlugs.add(slug)
    }

    const attributeSlugs = new Set<string>()
    for (const [k, v, slug] of ATTRIBUTE_RULES) {
      const actual = tags[k]
      if (actual !== undefined && (v === true || actual === v)) attributeSlugs.add(slug)
    }

    const normalized = normalizeName(name)
    const website = tags.website ?? tags['contact:website'] ?? null

    return {
      externalId: `${el.type}/${el.id}`,
      name: normalized.trade,
      legalName: name,
      phones: extractPhones(tags.phone ?? tags['contact:phone'] ?? null),
      email: tags.email ?? tags['contact:email'] ?? null,
      website,
      facebook: socialHandle(tags['contact:facebook'] ?? null, 'facebook'),
      instagram: socialHandle(tags['contact:instagram'] ?? null, 'instagram'),
      lat: el.lat ?? el.center?.lat ?? null,
      lng: el.lon ?? el.center?.lon ?? null,
      address: buildAddress(tags),
      placeSlug: null,
      categorySlugs: [...categorySlugs],
      attributeSlugs: [...attributeSlugs],
      hours: parseOpeningHours(tags.opening_hours),
      description: tags.description ?? null,
    } satisfies NormalizedRecord
  },
}

function buildAddress(tags: Record<string, string>): string | null {
  const street = tags['addr:street']
  const number = tags['addr:housenumber']
  if (!street) return null
  return number ? `${street} ${number}` : street
}
