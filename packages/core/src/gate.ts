/**
 * The index gate.
 *
 * This is the rule that separates this project from every doorway-page
 * directory that got wiped out: a facet page renders for users but ships
 * noindex until it earns indexing. Enforced in code, not in discipline -
 * it must be impossible to publish a thin page by accident.
 */

export const MIN_ENTITIES = 4

export interface GateInput {
  /** Entities that are published AND actually qualify for this facet. */
  qualifyingEntities: number
  /**
   * Something this page shows that its parent category page does not:
   * a price range, weekend hours, a service breakdown. Without one, the
   * page is a duplicate of its parent with a different title.
   */
  distinctDimensions: string[]
  /** Intro sentences generated from real fields, not a template with a hole. */
  hasDataDrivenIntro: boolean
}

export interface GateResult {
  indexable: boolean
  reason: string
}

export function evaluateGate(input: GateInput): GateResult {
  if (input.qualifyingEntities < MIN_ENTITIES) {
    return {
      indexable: false,
      reason: `Само ${input.qualifyingEntities} субјекти (потребни ${MIN_ENTITIES})`,
    }
  }
  if (input.distinctDimensions.length === 0) {
    return {
      indexable: false,
      reason: 'Нема податок што го нема на матичната категорија',
    }
  }
  if (!input.hasDataDrivenIntro) {
    return { indexable: false, reason: 'Нема вовед генериран од реални податоци' }
  }
  return {
    indexable: true,
    reason: `${input.qualifyingEntities} субјекти, димензии: ${input.distinctDimensions.join(', ')}`,
  }
}
