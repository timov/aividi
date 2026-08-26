import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import EmbeddedPostgres from 'embedded-postgres'

/**
 * A local Postgres with no install step.
 *
 * Docker is the right answer for a real machine (see docker-compose.yml), but
 * this gets the site running on a laptop that has neither Docker nor Postgres.
 * The data lives in ./data/pgdata and survives restarts.
 *
 * It runs a plain Postgres - no PostGIS. That is fine: nothing queries PostGIS
 * yet (distances are computed in JS), and migrate.ts creates the spatial index
 * only when the extension is present.
 *
 *   pnpm db:local          start, and keep running until Ctrl+C
 *   pnpm db:local --stop   stop a server left running
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = resolve(root, 'data', 'pgdata')

mkdirSync(dataDir, { recursive: true })

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'aividi',
  password: 'aividi',
  port: 5432,
  persistent: true,
  // Non-negotiable: initdb otherwise inherits the Windows ANSI codepage
  // (WIN1252), and every Cyrillic insert fails. Locale C keeps sorting
  // predictable; the app never relies on database collation for Macedonian.
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: () => {},
})

async function main() {
  if (process.argv.includes('--stop')) {
    await pg.stop()
    console.log('stopped.')
    return
  }

  // initialise() throws if the cluster already exists, which is the normal
  // case on every run after the first.
  try {
    await pg.initialise()
    console.log('initialised a new cluster in data/pgdata')
  } catch {
    console.log('using the existing cluster in data/pgdata')
  }

  await pg.start()

  try {
    await pg.createDatabase('aividi')
    console.log('created database "aividi"')
  } catch {
    // Already there.
  }

  console.log('\n  postgres ready on postgres://aividi:aividi@localhost:5432/aividi')
  console.log('  leave this running, and in another terminal:\n')
  console.log('    pnpm db:migrate && pnpm db:seed && pnpm db:seed:demo')
  console.log('    pnpm dev:web\n')
  console.log('  Ctrl+C to stop.')

  const shutdown = async () => {
    console.log('\nstopping postgres...')
    await pg.stop().catch(() => {})
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  // Hold the process open.
  await new Promise(() => {})
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
