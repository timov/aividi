import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

/**
 * One .env at the repo root, found by walking up from this file.
 *
 * Every entry point into the system - tsx scripts, the worker, drizzle-kit,
 * Next's server - imports the db client, and the db client imports this. So
 * there is exactly one place environment gets loaded and one file to edit.
 */
let dir = dirname(fileURLToPath(import.meta.url))

for (let i = 0; i < 7; i++) {
  const candidate = resolve(dir, '.env')
  if (existsSync(candidate)) {
    config({ path: candidate })
    break
  }
  const parent = dirname(dir)
  if (parent === dir) break
  dir = parent
}

export const DATABASE_URL = process.env.DATABASE_URL ?? ''
