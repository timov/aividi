import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { db, sql } from './client.js'

const here = dirname(fileURLToPath(import.meta.url))

async function main() {
  // Extensions must exist before the generated migrations create indexes
  // that reference gin_trgm_ops and ST_MakePoint.
  const extensions = await readFile(join(here, '..', 'sql', '000_extensions.sql'), 'utf8')
  console.log('applying extensions...')
  await sql.unsafe(extensions)

  console.log('running migrations...')
  await migrate(db, { migrationsFolder: join(here, '..', 'drizzle') })

  // Anything that depends on an optional extension goes here, after the
  // generated schema exists.
  const optional = await readFile(join(here, '..', 'sql', '010_postgis_optional.sql'), 'utf8')
  await sql.unsafe(optional)

  console.log('done.')
  await sql.end()
}

main().catch(async (err) => {
  console.error(err)
  await sql.end({ timeout: 1 }).catch(() => {})
  process.exit(1)
})
