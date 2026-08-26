import { csvAdapter } from './csv.js'
import { manualAdapter } from './manual.js'
import { osmAdapter } from './osm.js'
import { placesAdapter } from './places.js'
import type { SourceAdapter } from './types.js'

/**
 * `manual` covers hand-collected CSVs (sources/manual.ts). Single-record edits
 * still go straight to entity_field from the admin UI and need no adapter.
 */
const ADAPTERS: Partial<Record<string, SourceAdapter>> = {
  osm: osmAdapter,
  manual: manualAdapter,
  central_registry: csvAdapter,
  google_places: placesAdapter,
}

export function adapterFor(kind: string): SourceAdapter {
  const adapter = ADAPTERS[kind]
  if (!adapter) throw new Error(`No ingestion adapter for source kind "${kind}"`)
  return adapter
}

export function hasAdapter(kind: string): boolean {
  return kind in ADAPTERS
}

export { csvAdapter, manualAdapter, osmAdapter, placesAdapter }
export type { NormalizedRecord, SourceAdapter } from './types.js'
