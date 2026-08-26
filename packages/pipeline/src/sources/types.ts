import type { HourRow } from '@aividi/core'

/**
 * Opening hours use core's HourRow so there is exactly one shape for them
 * across the parser, the pipeline and the pages.
 *
 * Every adapter converts its own payload into exactly this shape. Nothing
 * downstream knows or cares which source a record came from - the pipeline
 * only sees NormalizedRecord plus the source's trust level.
 */
export interface NormalizedRecord {
  /** Stable id in the origin system. Used for source_record deduplication. */
  externalId: string
  name: string
  legalName?: string | null
  embs?: string | null
  edb?: string | null
  phones: string[]
  email?: string | null
  website?: string | null
  facebook?: string | null
  instagram?: string | null
  lat?: number | null
  lng?: number | null
  address?: string | null
  /** Resolved against place.slug during promote. */
  placeSlug?: string | null
  categorySlugs: string[]
  attributeSlugs: string[]
  hours: HourRow[]
  description?: string | null
  /** Our own summary of what customers say. Never third-party review text. */
  summary?: string | null
  /** Services with prices - the most citable data on the whole site. */
  services?: ServicePrice[]
  /** Aggregate rating seen elsewhere. Internal prioritisation signal only. */
  rating?: ExternalRating | null
  /**
   * Photographs OF THIS BUSINESS — ours, or the owner's. Never stock: a
   * generic interior presented as their premises is a picture of somewhere
   * else, and this whole project exists to be the opposite of that.
   */
  photos?: string[]
  /** The business's own mark. One per business. */
  logo?: string | null
  /** The wide image at the top of the profile. One per business. */
  cover?: string | null
}

export interface ServicePrice {
  /** Matches service.slug within the entity's category. */
  slug: string
  priceFrom?: number | null
  priceTo?: number | null
}

export interface ExternalRating {
  value: number
  count?: number | null
  /** Where it was observed, e.g. "google" - recorded, never rendered. */
  source: string
}

export interface FetchResult {
  externalId: string
  payload: Record<string, unknown>
}

export interface SourceAdapter {
  /** Pull raw records from the origin system. */
  fetch(config: Record<string, unknown>, limit?: number): Promise<FetchResult[]>
  /** Map one raw payload into the common shape. Return null to skip it. */
  normalize(payload: Record<string, unknown>): NormalizedRecord | null
}
