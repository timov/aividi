import { describe, expect, it } from 'vitest'
import { isIndexable } from '../src/lib/seo.js'

describe('isIndexable', () => {
  it('indexes the real domain', () => {
    expect(isIndexable('https://aividi.mk')).toBe(true)
  })

  it('refuses every throwaway preview host', () => {
    for (const url of [
      'https://aividi-git-main.vercel.app',
      'https://aividi.onrender.com',
      'https://aividi-production.up.railway.app',
      'https://aividi.fly.dev',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://abc123.ngrok-free.app',
    ]) {
      expect(isIndexable(url), url).toBe(false)
    }
  })

  it('lets the env force it either way', () => {
    // A custom staging domain we do want crawled, and a live domain we do not.
    expect(isIndexable('https://test.aividi.mk', '1')).toBe(true)
    expect(isIndexable('https://aividi.mk', '0')).toBe(false)
  })
})
