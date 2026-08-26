/**
 * Macedonian Cyrillic <-> Latin.
 *
 * Macedonian businesses write their own names inconsistently - "Кај Мире",
 * "Kaj Mire", "Kaj Mirè", "КАЈ МИРЕ ДООЕЛ" - and that inconsistency is the
 * single largest source of duplicate entities. Two functions solve it:
 *
 *   toLatin(s)   proper romanisation, used for slugs and Latin display
 *   matchKey(s)  aggressive fold to one comparable form, used for blocking
 *
 * matchKey deliberately over-collapses (sh -> s, dz -> z). It is never shown
 * to anyone; it only has to put the same business in the same bucket. The
 * fuzzy score then runs on the properly transliterated form.
 */

/**
 * Ѕ and Џ both romanise to "dz" in the official passport table, which loses
 * information. We use dz / dzh to keep them distinct and still ASCII.
 */
const CYR_TO_LAT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ѓ: 'gj', е: 'e', ж: 'zh',
  з: 'z', ѕ: 'dz', и: 'i', ј: 'j', к: 'k', л: 'l', љ: 'lj', м: 'm',
  н: 'n', њ: 'nj', о: 'o', п: 'p', р: 'r', с: 's', т: 't', ќ: 'kj',
  у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', џ: 'dzh', ш: 'sh',
  // Neighbours' letters turn up in scraped data often enough to handle.
  ђ: 'gj', ћ: 'kj', й: 'j', ы: 'i', щ: 'sht', ъ: 'a', ь: '', э: 'e',
  ю: 'ju', я: 'ja', ё: 'e',
}

const LATIN_DIACRITICS: Record<string, string> = {
  č: 'ch', ć: 'kj', š: 'sh', ž: 'zh', đ: 'gj', ǵ: 'gj', ḱ: 'kj',
  ä: 'a', ë: 'e', ï: 'i', ö: 'o', ü: 'u', à: 'a', è: 'e', é: 'e',
  á: 'a', í: 'i', ó: 'o', ú: 'u', ñ: 'n', ç: 'c',
}

export function isCyrillic(input: string): boolean {
  return /[Ѐ-ӿ]/.test(input)
}

/** Proper romanisation. Preserves word boundaries and case-insensitive input. */
export function toLatin(input: string): string {
  let out = ''
  for (const ch of input.toLowerCase()) {
    const mapped = CYR_TO_LAT[ch] ?? LATIN_DIACRITICS[ch]
    out += mapped ?? ch
  }
  return out
}

/**
 * The one form both scripts fold into. Applied to every entity name on write
 * and stored as entity.name_norm, which carries the trigram index.
 */
export function matchKey(input: string): string {
  // 1. Romanise, then strip any combining marks the map did not catch.
  let s = toLatin(input)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')

  // 2. Collapse digraphs so "Шара"/"Shara"/"Šara"/"Sara" all agree.
  //    Order matters: longest first, and dzh must fold before dz.
  s = s
    .replace(/dzh/g, 'dz')
    .replace(/dz/g, 'z')
    .replace(/zh/g, 'z')
    .replace(/sh/g, 's')
    .replace(/ch/g, 'c')
    .replace(/ts/g, 'c')
    .replace(/gj/g, 'g')
    .replace(/kj/g, 'k')
    .replace(/lj/g, 'l')
    .replace(/nj/g, 'n')
    .replace(/x/g, 'h')
    .replace(/y/g, 'i')
    .replace(/w/g, 'v')

  // 3. Keep letters, digits and single spaces only.
  s = s.replace(/[^a-z0-9]+/g, ' ').trim()

  // 4. Collapse doubled letters: "kafee" and "kafe" are the same shop.
  s = s.replace(/(.)\1+/g, '$1')

  return s.replace(/\s+/g, ' ')
}

/** URL-safe ASCII slug. Used for entity, place and category paths. */
export function slugify(input: string): string {
  return toLatin(input)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80)
}
