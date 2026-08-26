import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://aividi:aividi@localhost:5432/aividi',
  },
  casing: 'snake_case',
  verbose: true,
  strict: true,
})
