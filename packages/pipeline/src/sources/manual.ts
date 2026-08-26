import { readFile } from 'node:fs/promises'
import { parse } from 'csv-parse/sync'
import {
  extractPhones,
  normalizeName,
  parseMacedonianHours,
  parseOpeningHours,
  socialHandle,
} from '@aividi/core'
import type { FetchResult, NormalizedRecord, ServicePrice, SourceAdapter } from './types.js'

/**
 * Hand-collected businesses, one CSV per category per town.
 *
 * This is the highest-trust automated path into the graph, because a person
 * looked at each row. It is also how the first few categories should be built:
 * OSM knows 134 businesses exist in Strumica and can phone 22 of them, which
 * is breadth without depth. Depth is the moat and it is typed in by hand.
 *
 * COLUMNS  (only `name` and `category` are required)
 * ---------------------------------------------------------------------------
 *   name            Виа Пица
 *   category        picerii                 category slug
 *   address         Партизанска 5
 *   lat, lng        41.4376  22.6432        decimal degrees, from the map pin
 *   phone           070/123-456             several allowed: "070... , 034..."
 *   website         viapica.mk
 *   facebook        viapizzastrumica        handle or full URL
 *   instagram       viapizzastrumica
 *   email           kontakt@viapica.mk
 *   description     Пица од фурна на дрва…  one or two factual sentences
 *   summary         Гостите ја фалат…       OUR words about what people say
 *   hours           Mo-Su 10:00-23:00       OSM syntax, OR plain Macedonian:
 *                   "Од понеделник до петок работи од 09:00 до 24:00.
 *                    Во недела е затворено."
 *   attributes      dostava|parking|terasa  attribute slugs, pipe-separated
 *   services        pica-golema:250-320|dostava-pica:50
 *   rating          4.6                     seen elsewhere; internal signal
 *   rating_count    213
 *   rating_source   google
 *   photos          foto1.jpg|https://…/foto2.jpg   pipe-separated
 *   logo            logo.png                      the business's own mark
 *   cover           cover.jpg                     wide image for the profile
 *
 * On `summary` vs review text: write what customers consistently say, in your
 * own words ("Гостите редовно ја фалат скарата; забелешки има за паркингот").
 * Do not paste individual reviews - they are written by identifiable people,
 * they are not ours to republish, and a summary is the more quotable artefact
 * anyway. Same for photos: shoot them, or get them from the owner.
 */

interface ManualConfig {
  path: string
  delimiter?: string
  /** Recorded on every row so provenance shows who typed it in. */
  collectedBy?: string
}

type Row = Record<string, string>

function val(row: Row, key: string): string | null {
  const v = row[key]
  return v && v.trim() ? v.trim() : null
}

function num(row: Row, key: string): number | null {
  const v = val(row, key)
  if (v === null) return null
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** "pica-golema:250-320|dostava-pica:50" */
export function parseServices(spec: string | null): ServicePrice[] {
  if (!spec) return []
  const out: ServicePrice[] = []

  for (const part of spec.split('|')) {
    const [slug, price] = part.split(':').map((s) => s.trim())
    if (!slug) continue
    if (!price) {
      out.push({ slug })
      continue
    }
    const [from, to] = price.split('-').map((s) => Number(s.trim()))
    out.push({
      slug,
      priceFrom: Number.isFinite(from) ? from : null,
      priceTo: Number.isFinite(to) ? to : (Number.isFinite(from) ? from : null),
    })
  }
  return out
}

/** "dostava|parking|terasa" */
export function parseAttributes(spec: string | null): string[] {
  if (!spec) return []
  return spec
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Accepts either notation. Whoever is collecting the data should not have to
 * learn OSM syntax, so a sentence in Macedonian is a first-class input; the
 * compact form still works for rows copied out of OSM.
 */
function readHours(raw: string | null): ReturnType<typeof parseOpeningHours> {
  if (!raw) return []
  const compact = parseOpeningHours(raw)
  if (compact.length > 0) return compact
  return parseMacedonianHours(raw)
}

export const manualAdapter: SourceAdapter = {
  async fetch(config, limit) {
    const cfg = config as unknown as ManualConfig
    if (!cfg.path) throw new Error('manual source needs config.path pointing at a CSV')

    const text = await readFile(cfg.path, 'utf8')
    const rows = parse(text, {
      columns: true,
      skip_empty_lines: true,
      delimiter: cfg.delimiter ?? ',',
      bom: true,
      trim: true,
      // Let a half-filled template through rather than failing the whole file.
      relax_column_count: true,
    }) as Row[]

    const usable = rows.filter((r) => val(r, 'name') && val(r, 'category'))
    const skipped = rows.length - usable.length
    if (skipped > 0) console.warn(`  ${skipped} row(s) skipped: missing name or category`)

    const sliced = limit ? usable.slice(0, limit) : usable

    return sliced.map<FetchResult>((row) => ({
      // Name + category is stable enough to re-import the same file and update
      // rather than duplicate. Matching then handles the rest.
      externalId: `${val(row, 'category')}/${normalizeName(val(row, 'name') ?? '').slug}`,
      payload: { ...row, __collectedBy: cfg.collectedBy ?? 'manual' },
    }))
  },

  normalize(payload) {
    const row = payload as Row
    const rawName = val(row, 'name')
    const categorySlug = val(row, 'category')
    if (!rawName || !categorySlug) return null

    const name = normalizeName(rawName)
    const rating = num(row, 'rating')

    return {
      externalId: `${categorySlug}/${name.slug}`,
      name: name.trade,
      legalName: name.legal !== name.trade ? name.legal : null,
      phones: extractPhones(val(row, 'phone')),
      email: val(row, 'email'),
      website: val(row, 'website'),
      facebook: socialHandle(val(row, 'facebook'), 'facebook'),
      instagram: socialHandle(val(row, 'instagram'), 'instagram'),
      lat: num(row, 'lat'),
      lng: num(row, 'lng'),
      address: val(row, 'address'),
      placeSlug: val(row, 'place'),
      categorySlugs: [categorySlug],
      attributeSlugs: parseAttributes(val(row, 'attributes')),
      hours: readHours(val(row, 'hours')),
      description: val(row, 'description'),
      summary: val(row, 'summary'),
      services: parseServices(val(row, 'services')),
      photos: parseAttributes(val(row, 'photos')),
      logo: val(row, 'logo'),
      cover: val(row, 'cover'),
      rating:
        rating !== null
          ? {
              value: rating,
              count: num(row, 'rating_count'),
              source: val(row, 'rating_source') ?? 'unknown',
            }
          : null,
    }
  },
}
