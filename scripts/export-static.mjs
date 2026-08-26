/**
 * Builds the PUBLIC site as plain files, for GitHub Pages.
 *
 *   pnpm export:static                      → apps/web/out
 *   EXPORT_BASE_PATH=/aividi pnpm export:static   → for a project site
 *
 * This is a showcase build, not the production target. A static export has no
 * server, so three things simply do not exist in it:
 *
 *   · the admin, which needs server actions and a cookie session
 *   · /prebaraj, which reads the query string on the server
 *   · any freshness — every page is frozen at the moment it was built
 *
 * The admin is excluded by moving it into a folder Next treats as private
 * (a leading underscore is excluded from routing). The move is undone in a
 * finally block, so an interrupted or failed build still leaves the working
 * tree exactly as it was — that is the part worth being careful about, since
 * a half-renamed app/ directory would look like the admin had been deleted.
 */
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const appDir = join(root, 'apps', 'web', 'src', 'app')

/** Routes that cannot exist without a server. */
const EXCLUDED = ['admin', 'login', '(public)/prebaraj']

const moved = []

function hide(rel) {
  const from = join(appDir, rel)
  if (!existsSync(from)) return
  const parts = rel.split('/')
  parts[parts.length - 1] = `_${parts[parts.length - 1]}`
  const to = join(appDir, ...parts)
  renameSync(from, to)
  moved.push([to, from])
}

function restore() {
  // Reverse order, so a nested move is undone before its parent.
  for (const [from, to] of moved.reverse()) {
    if (existsSync(from)) renameSync(from, to)
  }
  moved.length = 0
}

/**
 * Next writes Open Graph images as EXTENSIONLESS files (opengraph-image-1jb0ym).
 * That is fine behind a Node server, which sets the content type itself, but a
 * static host derives it from the extension — so every one of them ships as
 * application/octet-stream, and Facebook, Viber and WhatsApp all refuse to
 * render an image that is not served as one. Shared links come out as bare
 * grey rectangles, which is the exact failure the OG tags exist to prevent.
 *
 * So: give them a .png extension and rewrite every reference to match.
 */
const OG_FILE = /^opengraph-image-[a-z0-9]+$/i

function walk(dir, onFile) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, onFile)
    else onFile(full, name)
  }
}

function fixOgImageExtensions(outDir) {
  const names = new Set()
  let files = 0

  // walk() only yields files, which matters here: _next/static/chunks holds
  // DIRECTORIES with these same names, and renaming those would break the JS.
  walk(outDir, (full, name) => {
    if (!OG_FILE.test(name)) return
    renameSync(full, `${full}.png`)
    names.add(name)
    files += 1
  })

  if (files === 0) return 0

  // The reference carries a cache-busting query, so match the bare name and
  // only when a .png is not already there.
  const pattern = new RegExp(`(${[...names].join('|')})(?!\.png)`, 'g')

  walk(outDir, (full, name) => {
    if (!/\.(html|txt|xml|json|js)$/i.test(name)) return
    const before = readFileSync(full, 'utf8')
    const after = before.replace(pattern, '$1.png')
    if (after !== before) writeFileSync(full, after)
  })

  return files
}

let failed = false
try {
  for (const rel of EXCLUDED) hide(rel)

  const outDir = join(root, 'apps', 'web', 'out')
  rmSync(outDir, { recursive: true, force: true })

  execFileSync('pnpm', ['--filter', '@aividi/web', 'run', 'build'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, STATIC_EXPORT: '1' },
  })

  // Without this, GitHub Pages runs the output through Jekyll, which silently
  // drops every directory beginning with an underscore — including Next's
  // _next/ folder, so the site loads with no CSS or JS at all.
  writeFileSync(join(outDir, '.nojekyll'), '')

  const renamed = fixOgImageExtensions(outDir)
  if (renamed) console.log(`Gave ${renamed} Open Graph images a .png extension.`)

  console.log(`\nStatic site written to apps/web/out`)
  console.log('Excluded (they need a server):', EXCLUDED.join(', '))
} catch (err) {
  failed = true
  console.error('\nExport failed:', err instanceof Error ? err.message : err)
} finally {
  restore()
  console.log('Working tree restored.')
}

process.exit(failed ? 1 : 0)
