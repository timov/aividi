export { isCyrillic, matchKey, slugify, toLatin } from './translit.js'
export {
  extractPhones,
  hostOf,
  isMobile,
  normalizeAddress,
  normalizeMkPhone,
  normalizeName,
  normalizeUrl,
  socialHandle,
  type NormalizedName,
} from './normalize.js'
export {
  diceCoefficient,
  jaroWinkler,
  nameSimilarity,
  tokenOverlap,
} from './similarity.js'
export {
  blockingKeys,
  haversine,
  pairKey,
  scoreMatch,
  type MatchInput,
  type MatchResult,
  type Verdict,
} from './match.js'
export {
  computeScore,
  SCORE_LABELS,
  SCORE_WEIGHTS,
  type ScoreInput,
  type ScoreResult,
} from './score.js'
export {
  effectiveWeight,
  resolveField,
  verificationFreshness,
  type FieldCandidate,
  type ResolvedField,
} from './provenance.js'
export { evaluateGate, MIN_ENTITIES, type GateInput, type GateResult } from './gate.js'
export {
  getModifier,
  isModifier,
  MODIFIERS,
  type ModifierDef,
} from './modifiers.js'
export { parseMacedonianHours } from './hours-mk.js'
export {
  openStatus,
  parseOpeningHours,
  skopjeNow,
  weeklySummary,
  type HourRow,
  type OpenState,
  type OpenStatus,
} from './hours.js'
export {
  computeKarma,
  karmaBand,
  KARMA_LABELS,
  KARMA_WEIGHTS,
  type KarmaInput,
  type KarmaResult,
} from './karma.js'
