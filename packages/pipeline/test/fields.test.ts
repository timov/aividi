import { describe, expect, it } from 'vitest'
import { entity } from '@aividi/db'
import { FIELD_COLUMNS } from '../src/fields.js'

/**
 * Regression guard for a bug that cost an afternoon: FIELD_COLUMNS used to
 * hold database column names (`phone_e164`), but drizzle's .set() takes JS
 * property names (`phoneE164`) and silently ignores anything else. Half the
 * provenance layer wrote nothing, with no error anywhere.
 */
describe('FIELD_COLUMNS', () => {
  it('maps every field key to a real property on the entity table', () => {
    for (const [key, property] of Object.entries(FIELD_COLUMNS)) {
      expect(entity, `${key} -> ${property}`).toHaveProperty(property)
    }
  })

  it('never maps to a snake_case name', () => {
    for (const property of Object.values(FIELD_COLUMNS)) {
      expect(property).not.toMatch(/_/)
    }
  })

  it('covers the derived columns materializeEntity also writes', () => {
    for (const derived of ['nameLat', 'nameNorm', 'websiteHost']) {
      expect(entity).toHaveProperty(derived)
    }
  })
})
