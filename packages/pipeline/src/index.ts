export {
  applyFields,
  FIELD_COLUMNS,
  ensureSlug,
  markVerified,
  materializeEntity,
  type ApplyFieldsInput,
  type FieldKey,
} from './fields.js'
export { isMergeable, mergeEntities, rejectMatch } from './merge.js'
export {
  promote,
  type PromoteAction,
  type PromoteResult,
} from './promote.js'
export { ingest, type IngestResult } from './ingest.js'
export { score } from './score.js'
export { adapterFor, hasAdapter } from './sources/index.js'
export type { NormalizedRecord, SourceAdapter } from './sources/types.js'
export {
  buildList,
  MAX_SPONSORED,
  placeFamily,
  rebuildAllLists,
  rebuildListsForPlace,
  type BuildListResult,
} from './lists.js'
export * from './articles.js'
