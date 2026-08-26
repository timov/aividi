import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import './env.js'
import * as schema from './schema.js'

const url = process.env.DATABASE_URL

if (!url) {
  // Deliberately not a throw: `next build` imports this module while
  // pre-rendering, and a build should not need a live database. The first
  // actual query then fails with a connection error naming this variable.
  console.warn(
    '[@aividi/db] DATABASE_URL is not set. Copy .env.example to .env at the repo root.',
  )
}

/**
 * One pool per process. Next dev reloads modules on every edit, so the client
 * is parked on globalThis to avoid leaking connections until Postgres refuses.
 */
const globalForDb = globalThis as unknown as { __aividiSql?: postgres.Sql }

export const sql =
  globalForDb.__aividiSql ??
  postgres(url ?? 'postgres://aividi:aividi@localhost:5432/aividi', {
    max: process.env.NODE_ENV === 'production' ? 10 : 4,
    // Money stays a string all the way from Postgres to the page - a float
    // round-trip is not something you want to discover on an invoice.
    types: {},
  })

if (process.env.NODE_ENV !== 'production') globalForDb.__aividiSql = sql

export const db = drizzle(sql, { schema, casing: 'snake_case' })

export type Db = typeof db
