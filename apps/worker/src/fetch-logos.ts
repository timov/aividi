import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { and, db, entity, eq, isNotNull, media, ne, sql } from '@aividi/db'

/**
 * Business logos, taken from each business's OWN website.
 *
 *   pnpm logos:fetch            fetch for businesses that have a website
 *   pnpm logos:fetch --force    re-fetch even where a logo already exists
 *
 * Why not "search the web for the logo": because an image search cannot tell
 * the difference between a business's own mark, a competitor's, a stock icon
 * and a photo somebody else owns — and putting the wrong logo on a named
 * business is worse than having none. What a site publishes about itself in
 * apple-touch-icon / og:image / <link rel=icon> IS its mark, put there by the
 * owner for exactly this purpose. So we only take that.
 *
 * Expect modest coverage. Most Macedonian SMBs have no website at all: of the
 * first 134 businesses ingested from OSM, 16 had one. The rest need the claim
 * flow or a photo from you. That is the real state of the market, not a bug in
 * the script.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const outDir = join(root, 'apps', 'web', 'public', 'logos')

const UA =
  'Mozilla/5.0 (compatible; aividi.mk/0.1; +https://aividi.mk/prijavi) logo fetcher'

interface Candidate {
  url: string
  /** Higher is better: a purpose-made touch icon beats a 16px favicon. */
  rank: number
}

function abs(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString()
  } catch {
    return null
  }
}

/** Everything a site offers as its own mark, best first. */
function findIcons(html: string, base: string): Candidate[] {
  const out: Candidate[] = []
  const push = (href: string | undefined, rank: number) => {
    if (!href) return
    const url = abs(href, base)
    if (url) out.push({ url, rank })
  }

  for (const tag of html.match(/<link[^>]+>/gi) ?? []) {
    const rel = (tag.match(/rel=["']([^"']+)["']/i)?.[1] ?? '').toLowerCase()
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1]
    const sizes = tag.match(/sizes=["'](\d+)/i)?.[1]
    if (!href) continue
    if (rel.includes('apple-touch-icon')) push(href, 100 + Number(sizes ?? 0))
    else if (rel.includes('mask-icon')) push(href, 60)
    else if (rel.includes('icon')) push(href, 40 + Number(sizes ?? 0) / 10)
  }

  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]
  push(og, 80)
  push('/apple-touch-icon.png', 20)
  push('/favicon.ico', 10)

  return out.sort((a, b) => b.rank - a.rank)
}

/** Reads the header bytes so a 16×16 favicon never becomes a logo. */
function imageSize(buf: Buffer): { w: number; h: number; type: string } | null {
  if (buf.length > 24 && buf.subarray(0, 8).toString('binary') === '\x89PNG\r\n\x1a\n') {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), type: 'png' }
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) {
        i++
        continue
      }
      const marker = buf[i + 1] ?? 0
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7), type: 'jpg' }
      }
      i += 2 + buf.readUInt16BE(i + 2)
    }
  }
  if (buf.subarray(0, 4).toString('binary') === 'RIFF') return { w: 0, h: 0, type: 'webp' }
  if (buf.subarray(0, 5).toString('binary').includes('<svg')) return { w: 0, h: 0, type: 'svg' }
  return null
}

async function get(url: string, timeoutMs = 12000): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { headers: { 'User-Agent': UA }, signal: controller.signal })
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function main() {
  const force = process.argv.includes('--force')
  mkdirSync(outDir, { recursive: true })

  const rows = await db
    .select({ id: entity.id, slug: entity.slug, name: entity.nameMk, website: entity.website })
    .from(entity)
    .where(and(isNotNull(entity.website), ne(entity.status, 'merged')))

  console.log(`${rows.length} businesses have a website\n`)
  let saved = 0

  for (const row of rows) {
    if (!row.slug || !row.website) continue

    const existing = await db
      .select({ id: media.id })
      .from(media)
      .where(and(eq(media.entityId, row.id), eq(media.kind, 'logo')))
      .limit(1)
    if (existing.length > 0 && !force) continue

    const page = await get(row.website)
    if (!page?.ok) {
      console.log(`  ${row.name.slice(0, 26).padEnd(28)} site unreachable`)
      continue
    }

    const html = await page.text()
    let stored = false

    for (const candidate of findIcons(html, page.url).slice(0, 5)) {
      const res = await get(candidate.url, 9000)
      if (!res?.ok) continue
      const buf = Buffer.from(await res.arrayBuffer())
      const size = imageSize(buf)
      // A 16 or 32px favicon is a browser-tab asset, not a logo.
      if (!size || (size.w > 0 && Math.max(size.w, size.h) < 96)) continue

      const ext = size.type === 'svg' ? 'svg' : size.type === 'jpg' ? 'jpg' : 'png'
      const file = `${row.slug}.${ext}`
      writeFileSync(join(outDir, file), buf)

      await db
        .insert(media)
        .values({
          entityId: row.id,
          key: `logos/${file}`,
          kind: 'logo',
          credit: new URL(row.website).hostname,
          width: size.w || null,
          height: size.h || null,
          sort: 0,
        })
        .onConflictDoNothing()

      console.log(
        `  ${row.name.slice(0, 26).padEnd(28)} ${ext.padEnd(4)} ${size.w || '?'}×${size.h || '?'}`,
      )
      stored = true
      saved++
      break
    }

    if (!stored) console.log(`  ${row.name.slice(0, 26).padEnd(28)} no usable mark`)
    await new Promise((r) => setTimeout(r, 250))
  }

  console.log(`\n  ${saved} logos saved to apps/web/public/logos/`)
  console.log('  Anything without one needs the claim flow or a photo from you.')
  await sql.end()
}

main().catch(async (err) => {
  console.error(err)
  await sql.end({ timeout: 1 }).catch(() => {})
  process.exit(1)
})
