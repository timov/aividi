import { readFile } from 'node:fs/promises'
import { parse } from 'csv-parse/sync'
import { extractPhones, normalizeName } from '@aividi/core'
import type { FetchResult, NormalizedRecord, SourceAdapter } from './types.js'

/**
 * Generic CSV importer, used for the Central Registry extract.
 *
 * The registry is the best possible spine for the graph: it carries EMBS,
 * which is the only authoritative identifier in the country and turns matching
 * from probabilistic into deterministic. We don't know the exact column names
 * of whatever extract you end up with, so they're configured per source:
 *
 *   config = {
 *     "path": "./data/crm-strumica.csv",
 *     "delimiter": ",",
 *     "columns": {
 *       "name": "Назив",
 *       "embs": "ЕМБС",
 *       "edb": "ЕДБ",
 *       "address": "Адреса",
 *       "phone": "Телефон",
 *       "place": "Место",
 *       "nkd": "Приоритетна дејност"
 *     }
 *   }
 */

interface CsvConfig {
  path: string
  delimiter?: string
  columns: Record<string, string>
  /** Maps NKD activity codes onto our category slugs. */
  nkdMap?: Record<string, string>
}

function pick(row: Record<string, string>, columns: Record<string, string>, key: string) {
  const column = columns[key]
  if (!column) return null
  const value = row[column]
  return value?.trim() || null
}

export const csvAdapter: SourceAdapter = {
  async fetch(config, limit) {
    const cfg = config as unknown as CsvConfig
    if (!cfg.path) throw new Error('csv source needs config.path')

    const text = await readFile(cfg.path, 'utf8')
    const rows = parse(text, {
      columns: true,
      skip_empty_lines: true,
      delimiter: cfg.delimiter ?? ',',
      bom: true,
      trim: true,
    }) as Record<string, string>[]

    const sliced = limit ? rows.slice(0, limit) : rows

    return sliced.map<FetchResult>((row, i) => {
      const embs = pick(row, cfg.columns, 'embs')
      return {
        // EMBS makes the best external id. Fall back to the row number so a
        // re-run still updates the same record rather than duplicating it.
        externalId: embs ?? `row/${i + 1}`,
        payload: { ...row, __columns: cfg.columns, __nkdMap: cfg.nkdMap ?? {} },
      }
    })
  },

  normalize(payload) {
    const row = payload as Record<string, string>
    const columns = (payload.__columns ?? {}) as Record<string, string>
    const nkdMap = (payload.__nkdMap ?? {}) as Record<string, string>

    const rawName = pick(row, columns, 'name')
    if (!rawName) return null

    const normalized = normalizeName(rawName)
    const nkd = pick(row, columns, 'nkd')
    const categorySlug = nkd ? nkdMap[nkd] ?? nkdMap[nkd.slice(0, 5)] ?? null : null

    return {
      externalId: pick(row, columns, 'embs') ?? normalized.slug,
      name: normalized.trade,
      // The registry name is the legal name by definition - keep it whole.
      legalName: normalized.legal,
      embs: pick(row, columns, 'embs'),
      edb: pick(row, columns, 'edb'),
      phones: extractPhones(pick(row, columns, 'phone')),
      email: pick(row, columns, 'email'),
      website: pick(row, columns, 'website'),
      lat: null,
      lng: null,
      address: pick(row, columns, 'address'),
      placeSlug: null,
      categorySlugs: categorySlug ? [categorySlug] : [],
      attributeSlugs: [],
      hours: [],
      description: null,
    } satisfies NormalizedRecord
  },
}
