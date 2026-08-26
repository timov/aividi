/** String similarity primitives used by the matcher. No dependencies on purpose. */

function jaro(s1: string, s2: string): number {
  if (s1 === s2) return 1
  const l1 = s1.length
  const l2 = s2.length
  if (l1 === 0 || l2 === 0) return 0

  const window = Math.max(0, Math.floor(Math.max(l1, l2) / 2) - 1)
  const flags1 = new Array<boolean>(l1).fill(false)
  const flags2 = new Array<boolean>(l2).fill(false)

  let matches = 0
  for (let i = 0; i < l1; i++) {
    const start = Math.max(0, i - window)
    const end = Math.min(i + window + 1, l2)
    for (let k = start; k < end; k++) {
      if (flags2[k]) continue
      if (s1[i] !== s2[k]) continue
      flags1[i] = true
      flags2[k] = true
      matches++
      break
    }
  }
  if (matches === 0) return 0

  let transpositions = 0
  let k = 0
  for (let i = 0; i < l1; i++) {
    if (!flags1[i]) continue
    while (k < l2 && !flags2[k]) k++
    if (k < l2 && s1[i] !== s2[k]) transpositions++
    k++
  }

  return (matches / l1 + matches / l2 + (matches - transpositions / 2) / matches) / 3
}

/** Jaro-Winkler: rewards a shared prefix, which suits business names well. */
export function jaroWinkler(a: string, b: string): number {
  const j = jaro(a, b)
  if (j < 0.7) return j
  let prefix = 0
  const max = Math.min(4, a.length, b.length)
  for (let i = 0; i < max; i++) {
    if (a[i] !== b[i]) break
    prefix++
  }
  return j + prefix * 0.1 * (1 - j)
}

function bigrams(s: string): string[] {
  const out: string[] = []
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2))
  return out
}

/** Sørensen-Dice on character bigrams. Tolerant of word reordering. */
export function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const aGrams = bigrams(a)
  const counts = new Map<string, number>()
  for (const g of aGrams) counts.set(g, (counts.get(g) ?? 0) + 1)

  let hits = 0
  for (const g of bigrams(b)) {
    const c = counts.get(g) ?? 0
    if (c > 0) {
      counts.set(g, c - 1)
      hits++
    }
  }
  return (2 * hits) / (aGrams.length + bigrams(b).length)
}

/**
 * Share of the shorter name's tokens that appear in the longer one.
 * Catches "Пицерија Виа" vs "Виа" - a very common pair in scraped data.
 */
export function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.split(' ').filter(Boolean))
  const tb = new Set(b.split(' ').filter(Boolean))
  if (ta.size === 0 || tb.size === 0) return 0
  let hits = 0
  for (const t of ta) if (tb.has(t)) hits++
  return hits / Math.min(ta.size, tb.size)
}

/**
 * The single name-similarity number the matcher uses. Takes the best of three
 * views so no one weakness (reordering, truncation, prefixes) dominates.
 */
export function nameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  return Math.max(jaroWinkler(a, b), diceCoefficient(a, b), tokenOverlap(a, b) * 0.95)
}
