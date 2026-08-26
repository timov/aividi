import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Category cover photographs, from Wikimedia Commons.
 *
 *   pnpm covers:fetch            fetch any that are missing
 *   pnpm covers:fetch --force    re-fetch everything
 *
 * Commons is used rather than a stock site because every file states its
 * licence in the API response, so we can *prefer public domain* and record
 * attribution for anything that needs it — instead of assuming a blanket
 * "free" that turns out to have conditions. Licence and author land in
 * covers/credits.json and are rendered under the image.
 *
 * These are CATEGORY illustrations. A photograph of a pizzeria somewhere in
 * Europe on the "Пицерии" page misleads nobody. Never point one of these at a
 * named business — a profile may only show photographs of that business.
 *
 * Treat the result as a starting point. Review each one, and replace them with
 * photographs from Strumica as you take them.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'apps', 'web', 'public', 'covers')

/** Search terms per category, most specific first. */
const QUERIES: Record<string, string> = {
  restorani: 'restaurant interior tables photograph',
  kafulinja: 'cafe interior seating photograph',
  'brza-hrana': 'hamburger fries food photograph',
  picerii: 'pizza margherita food photograph',
  gostilnici: 'tavern interior wooden tables photograph',
  stomatolozi: 'dental surgery room equipment photograph',
  avtoservisi: 'auto repair shop mechanic photograph',
  majstori: 'carpenter workshop hand tools photograph',
  'saloni-za-ubavina': 'hairdressing salon chairs photograph',
  nedvizhnini: 'residential apartment building photograph',
  smestuvanje: 'hotel bedroom interior photograph',
  'svadbi-i-nastani': 'banquet hall set tables photograph',
  'advokati-i-smetkovodstvo': 'office desk documents photograph',
  prodavnici: 'supermarket aisle shelves photograph',
}

/** Public domain first; these need no attribution and cannot be revoked. */
const LICENCE_RANK = ['CC0', 'Public domain', 'CC BY 4.0', 'CC BY-SA 4.0', 'CC BY-SA 3.0']

/**
 * Commons free-text search surfaces a lot of marketing material — banners,
 * flyers and product adverts with English text burned into the image. Those
 * are worse than no photo at all on a Macedonian page, so they are filtered
 * out by title before anything is downloaded.
 */
const REJECT_TITLE =
  /logo|poster|advert|banner|flyer|leaflet|brochure|diagram|schema|map|chart|graph|screenshot|infographic|signage|menu|business card|icon|template|mockup|clipart|drawing|illustration|painting|engraving|patent|cover art/i

interface Candidate {
  title: string
  url: string
  licence: string
  artist: string
  width: number
  height: number
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function search(term: string): Promise<Candidate[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: `filetype:bitmap ${term}`,
    gsrlimit: '12',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|size',
    iiurlwidth: '1600',
  })

  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { 'User-Agent': 'aividi.mk cover fetcher (kontakt@aividi.mk)' },
  })
  if (!res.ok) throw new Error(`Commons ${res.status}`)

  const json = (await res.json()) as {
    query?: { pages?: Record<string, Record<string, unknown>> }
  }

  const out: Candidate[] = []
  for (const page of Object.values(json.query?.pages ?? {})) {
    const info = (page.imageinfo as Array<Record<string, unknown>> | undefined)?.[0]
    if (!info) continue
    const meta = (info.extmetadata ?? {}) as Record<string, { value?: string }>
    const url = String(info.thumburl ?? info.url ?? '')
    const width = Number(info.thumbwidth ?? 0)
    const height = Number(info.thumbheight ?? 0)
    const title = stripHtml(String(page.title ?? ''))
    // Landscape, but not a banner strip — and never a graphic.
    const ratio = height === 0 ? 0 : width / height
    if (!url || width < 1000 || ratio < 1.25 || ratio > 2.1) continue
    if (REJECT_TITLE.test(title)) continue
    out.push({
      title,
      url,
      licence: meta.LicenseShortName?.value ?? 'unknown',
      artist: stripHtml(meta.Artist?.value ?? ''),
      width,
      height,
    })
  }

  return out.sort((a, b) => {
    const ra = LICENCE_RANK.indexOf(a.licence)
    const rb = LICENCE_RANK.indexOf(b.licence)
    return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb)
  })
}

async function main() {
  const force = process.argv.includes('--force')
  mkdirSync(outDir, { recursive: true })

  const credits: Record<string, { title: string; licence: string; artist: string; source: string }> =
    {}

  for (const [slug, term] of Object.entries(QUERIES)) {
    const target = join(outDir, `${slug}.jpg`)
    // Never silently replace a cover you have already reviewed or swapped for
    // your own photograph. --force is the only way to overwrite.
    if (!force && existsSync(target)) {
      console.log(`  ${slug.padEnd(26)} kept (already present)`)
      continue
    }
    try {
      const candidates = await search(term)
      const pick = candidates.find((c) => LICENCE_RANK.includes(c.licence)) ?? candidates[0]
      if (!pick) {
        console.warn(`  ${slug.padEnd(26)} no usable result`)
        continue
      }

      const image = await fetch(pick.url, {
        headers: { 'User-Agent': 'aividi.mk cover fetcher (kontakt@aividi.mk)' },
      })
      writeFileSync(target, Buffer.from(await image.arrayBuffer()))

      credits[slug] = {
        title: pick.title,
        licence: pick.licence,
        artist: pick.artist,
        source: `https://commons.wikimedia.org/wiki/${encodeURIComponent(pick.title)}`,
      }
      const needsCredit = !['CC0', 'Public domain'].includes(pick.licence)
      console.log(
        `  ${slug.padEnd(26)} ${pick.licence.padEnd(14)} ${needsCredit ? 'credit required' : ''}`,
      )
    } catch (err) {
      console.warn(`  ${slug.padEnd(26)} failed: ${(err as Error).message}`)
    }
    // Be a polite API client.
    await new Promise((r) => setTimeout(r, 400))
  }

  writeFileSync(join(outDir, 'credits.json'), `${JSON.stringify(credits, null, 2)}\n`)
  console.log(`\n  wrote ${Object.keys(credits).length} covers + credits.json`)
  console.log('  Review each one before launch and swap in your own photos of Strumica.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
