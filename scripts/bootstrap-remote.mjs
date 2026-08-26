/**
 * Fills an empty remote database with everything the site needs to render.
 *
 *   DATABASE_URL="postgres://…neon.tech/aividi?sslmode=require" pnpm db:bootstrap
 *
 * There is no pg_dump in the embedded Postgres bundle this project uses, so
 * copying the local database is not an option. It does not matter: every step
 * below is plain Node talking to whatever DATABASE_URL points at, so the same
 * commands that built the local data rebuild it anywhere.
 *
 * Safe to re-run. Migrations are tracked, the seed upserts, and importing the
 * same CSV twice matches the existing rows instead of duplicating them.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set. Point it at the remote database first.')
  process.exit(1)
}
if (/localhost|127\.0\.0\.1/.test(url)) {
  console.error(`DATABASE_URL points at localhost (${url.replace(/:[^:@]*@/, ':***@')}).`)
  console.error('This command is for a REMOTE database — set it explicitly to avoid surprises.')
  process.exit(1)
}

const run = (label, args) => {
  console.log(`\n── ${label}`)
  execFileSync('pnpm', args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  })
}

console.log(`Target: ${url.replace(/:[^:@]*@/, ':***@')}`)

run('schema', ['db:migrate'])
run('places, categories and services', ['db:seed'])

// Every hand-collected CSV in data/. These are the rows that carry prices,
// hours and the summaries, which is most of what makes the site look alive.
const dataDir = join(root, 'data')
const csvs = existsSync(dataDir)
  ? readdirSync(dataDir).filter((f) => f.toLowerCase().endsWith('.csv'))
  : []

for (const csv of csvs) {
  run(`import ${csv}`, ['ingest', 'run', 'manual', join('data', csv)])
}

run('match and promote', ['ingest', 'promote'])
run('publish', ['ingest', 'publish'])
run('build lists', ['ingest', 'lists'])

console.log('\nDone. Optional next steps:')
console.log('  pnpm ingest article <place> <category>   scaffold a guide article')
console.log('  pnpm logos:fetch                         logos from business websites')
console.log('  pnpm ingest run osm <place>              wider coverage from OpenStreetMap')
