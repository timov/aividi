/**
 * Which towns have their own cover photo at /public/covers/places/{slug}.jpg.
 *
 * Unlike category covers, these are never stock: a photo on the "Струмица"
 * card has to actually be Струмица, so there is no licence-fetch script and
 * no credits map here - just the names of whoever supplied a real photo,
 * added one at a time as they arrive. See public/covers/places/README.md.
 */
export const PLACE_COVERS: Record<string, { credit?: string }> = {}

export function hasPlaceCover(slug: string): boolean {
  return slug in PLACE_COVERS
}

export function placeCoverCredit(slug: string): string | null {
  return PLACE_COVERS[slug]?.credit ?? null
}
