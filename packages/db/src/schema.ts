import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/* ==========================================================================
   Enums
   ========================================================================== */

export const sourceKind = pgEnum('source_kind', [
  'central_registry',
  'osm',
  'google_places',
  'facebook',
  'instagram',
  'website',
  'phone_verification',
  'manual',
  'owner',
])

export const entityStatus = pgEnum('entity_status', [
  'draft', // ingested, not reviewed
  'review', // flagged for a human
  'published', // live on the site
  'merged', // folded into another entity, see merged_into
  'closed', // business no longer operating
  'rejected', // not a real business / out of scope
])

export const matchDecision = pgEnum('match_decision', [
  'pending',
  'merged',
  'rejected',
  'auto_merged',
])

export const placeKind = pgEnum('place_kind', ['region', 'opstina', 'grad', 'naselba'])

export const lang = pgEnum('lang', ['mk', 'sq', 'en'])

export const categoryIntent = pgEnum('category_intent', ['traffic', 'money', 'both'])

export const tier = pgEnum('tier', ['free', 'verified', 'featured', 'ai_visibility'])

export const subscriptionStatus = pgEnum('subscription_status', [
  'active',
  'past_due',
  'cancelled',
])

export const aiEngine = pgEnum('ai_engine', [
  'chatgpt',
  'claude',
  'gemini',
  'perplexity',
  'google_aio',
])

export const leadStatus = pgEnum('lead_status', ['new', 'sold', 'closed', 'refunded'])

export const jobStatus = pgEnum('job_status', ['running', 'ok', 'failed'])

/* ==========================================================================
   Sources and raw records
   --------------------------------------------------------------------------
   The rule this whole schema exists to enforce: a scraped record is never
   the business. Raw payloads land in source_record and stay immutable.
   Canonical businesses live in `entity`. The join between them is explicit,
   reviewable, and reversible.
   ========================================================================== */

export const source = pgTable(
  'source',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: sourceKind('kind').notNull(),
    name: text('name').notNull(),
    /** Adapter-specific settings: bbox, area id, csv column map, ... */
    config: jsonb('config').$type<Record<string, unknown>>().default({}).notNull(),
    /**
     * Baseline trust, 0-100. Feeds field confidence, so the owner correcting
     * their own hours beats an OSM node from 2019 without any special-casing.
     */
    trust: smallint('trust').notNull().default(50),
    /** ODbL, Places ToS, etc. Rendered as attribution where required. */
    licence: text('licence'),
    active: boolean('active').notNull().default(true),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('source_kind_name_idx').on(t.kind, t.name)],
)

export const sourceRecord = pgTable(
  'source_record',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => source.id, { onDelete: 'cascade' }),
    /** Stable id in the origin system: OSM node/123, EMBS, place_id, csv row key. */
    externalId: text('external_id').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    /** sha256 of the payload - lets a re-run skip unchanged records cheaply. */
    hash: text('hash').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
    /** Null until the promote job has turned it into / merged it onto an entity. */
    processedAt: timestamp('processed_at', { withTimezone: true }),
    entityId: uuid('entity_id').references((): AnyPgColumn => entity.id, {
      onDelete: 'set null',
    }),
    error: text('error'),
  },
  (t) => [
    uniqueIndex('source_record_external_idx').on(t.sourceId, t.externalId),
    index('source_record_unprocessed_idx')
      .on(t.processedAt)
      .where(sql`${t.processedAt} is null`),
    index('source_record_entity_idx').on(t.entityId),
  ],
)

/* ==========================================================================
   Geography and taxonomy
   ========================================================================== */

export const place = pgTable(
  'place',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: placeKind('kind').notNull(),
    parentId: uuid('parent_id').references((): AnyPgColumn => place.id),
    slug: text('slug').notNull(),
    nameMk: text('name_mk').notNull(),
    nameSq: text('name_sq'),
    nameLat: text('name_lat').notNull(),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    population: integer('population'),
    /** Pilot cities render and index; everything else stays dark. */
    isPilot: boolean('is_pilot').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('place_slug_idx').on(t.slug),
    index('place_parent_idx').on(t.parentId),
  ],
)

export const category = pgTable(
  'category',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    parentId: uuid('parent_id').references((): AnyPgColumn => category.id),
    slug: text('slug').notNull(),
    nameMk: text('name_mk').notNull(),
    nameSq: text('name_sq'),
    /** schema.org type emitted on profiles: Dentist, AutoRepair, Restaurant... */
    schemaType: text('schema_type').notNull().default('LocalBusiness'),
    /** Macedonian activity codes, for matching Central Registry rows. */
    nkdCodes: text('nkd_codes').array().notNull().default(sql`'{}'::text[]`),
    /** Does this category bring traffic, money, or both? Drives priorities. */
    intent: categoryIntent('intent').notNull().default('traffic'),
    isPilot: boolean('is_pilot').notNull().default(false),
    sort: integer('sort').notNull().default(0),
  },
  (t) => [
    uniqueIndex('category_slug_idx').on(t.slug),
    index('category_parent_idx').on(t.parentId),
  ],
)

export const service = pgTable(
  'service',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => category.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    nameMk: text('name_mk').notNull(),
    nameSq: text('name_sq'),
    /** per_visit, per_hour, per_m2, per_piece - shown next to the price. */
    unit: text('unit').notNull().default('per_visit'),
    sort: integer('sort').notNull().default(0),
  },
  (t) => [uniqueIndex('service_slug_idx').on(t.categoryId, t.slug)],
)

export const attribute = pgTable(
  'attribute',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    nameMk: text('name_mk').notNull(),
    nameSq: text('name_sq'),
    /** bool | enum | text */
    kind: text('kind').notNull().default('bool'),
    options: text('options').array(),
    /** Empty means "applies everywhere". */
    categorySlugs: text('category_slugs').array().notNull().default(sql`'{}'::text[]`),
    sort: integer('sort').notNull().default(0),
  },
  (t) => [uniqueIndex('attribute_slug_idx').on(t.slug)],
)

/* ==========================================================================
   The canonical business
   ========================================================================== */

export const entity = pgTable(
  'entity',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug'),
    status: entityStatus('status').notNull().default('draft'),

    nameMk: text('name_mk').notNull(),
    nameSq: text('name_sq'),
    /** Proper transliteration, used for slugs and Latin-script display. */
    nameLat: text('name_lat').notNull(),
    /** Aggressively folded match key. Never shown. See core/translit.ts. */
    nameNorm: text('name_norm').notNull(),
    /** Full registered name, legal form and all. */
    legalName: text('legal_name'),

    /** The only authoritative identifiers in the country. */
    embs: text('embs'),
    edb: text('edb'),

    placeId: uuid('place_id').references(() => place.id),
    address: text('address'),
    addressNorm: text('address_norm'),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),

    phoneE164: text('phone_e164'),
    phoneAlt: text('phone_alt').array().notNull().default(sql`'{}'::text[]`),
    email: text('email'),
    website: text('website'),
    websiteHost: text('website_host'),
    facebook: text('facebook'),
    instagram: text('instagram'),

    descriptionMk: text('description_mk'),
    descriptionSq: text('description_sq'),
    priceLevel: smallint('price_level'),

    /**
     * "Што велат гостите" - our own summary of what customers consistently
     * say, written by us. This is deliberately NOT a store of review text:
     * reviews are authored by individual people and are not ours to
     * republish. A summary in our words is also the more citable artefact -
     * every model already has the raw reviews from wherever they were posted.
     */
    summaryMk: text('summary_mk'),

    /**
     * An aggregate rating observed somewhere else, kept as an internal signal
     * only: it prioritises the verification queue and flags businesses worth
     * calling first. It is never rendered on a public page - a number we did
     * not compute should not appear to be ours.
     */
    ratingExternal: real('rating_external'),
    reviewCountExternal: integer('review_count_external'),
    ratingSource: text('rating_source'),
    ratingCheckedAt: timestamp('rating_checked_at', { withTimezone: true }),

    claimedBy: uuid('claimed_by').references((): AnyPgColumn => account.id, {
      onDelete: 'set null',
    }),
    /** Set by a human who actually confirmed the core fields. */
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedBy: text('verified_by'),

    score: real('score'),
    scoreComputedAt: timestamp('score_computed_at', { withTimezone: true }),

    /**
     * Карма: what people think, as distinct from how good the record is.
     * Null until there are enough opinions to say anything honest.
     */
    karma: real('karma'),
    karmaReviews: integer('karma_reviews'),
    karmaConfidence: text('karma_confidence'),
    karmaComponents: jsonb('karma_components').$type<Record<string, number>>(),

    mergedInto: uuid('merged_into').references((): AnyPgColumn => entity.id),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('entity_slug_idx')
      .on(t.slug)
      .where(sql`${t.slug} is not null`),
    uniqueIndex('entity_embs_idx')
      .on(t.embs)
      .where(sql`${t.embs} is not null`),
    index('entity_status_idx').on(t.status),
    index('entity_place_idx').on(t.placeId),
    index('entity_phone_idx').on(t.phoneE164),
    // Trigram index: the blocking step for fuzzy name matching.
    index('entity_name_norm_trgm_idx').using('gin', sql`${t.nameNorm} gin_trgm_ops`),
    // The spatial index lives in sql/010_postgis_optional.sql rather than here:
    // nothing queries it yet (distance is computed in JS), and keeping it out
    // of the migration means the schema applies to a plain Postgres without
    // PostGIS. It is created automatically when the extension is present.
  ],
)

/**
 * Per-field provenance. Every value the graph knows arrives here first,
 * tagged with where it came from and how much we trust it. `entity` holds
 * only the *resolved* winner, recomputed by materializeEntity().
 */
export const entityField = pgTable(
  'entity_field',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entity.id, { onDelete: 'cascade' }),
    /** Column name on `entity`: phone_e164, website, address, ... */
    key: text('key').notNull(),
    value: text('value'),
    valueJson: jsonb('value_json'),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => source.id, { onDelete: 'cascade' }),
    sourceRecordId: uuid('source_record_id').references(() => sourceRecord.id, {
      onDelete: 'set null',
    }),
    /** 0..1. Starts at source.trust/100, raised by human verification. */
    confidence: real('confidence').notNull().default(0.5),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('entity_field_unique_idx').on(t.entityId, t.key, t.sourceId),
    index('entity_field_lookup_idx').on(t.entityId, t.key),
  ],
)

/**
 * Two entities that might be the same business. Produced by the promote job,
 * resolved by a human in /admin/matches (or auto-merged on a strong key).
 */
export const matchCandidate = pgTable(
  'match_candidate',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leftEntityId: uuid('left_entity_id')
      .notNull()
      .references(() => entity.id, { onDelete: 'cascade' }),
    rightEntityId: uuid('right_entity_id')
      .notNull()
      .references(() => entity.id, { onDelete: 'cascade' }),
    /** least(left,right)||greatest(left,right) - stops duplicate pairs. */
    pairKey: text('pair_key').notNull(),
    score: real('score').notNull(),
    features: jsonb('features').$type<Record<string, number | boolean | null>>().notNull(),
    decision: matchDecision('decision').notNull().default('pending'),
    decidedBy: text('decided_by'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('match_candidate_pair_idx').on(t.pairKey),
    index('match_candidate_pending_idx')
      .on(t.score)
      .where(sql`${t.decision} = 'pending'`),
  ],
)

/* ==========================================================================
   Entity detail
   ========================================================================== */

export const entityCategory = pgTable(
  'entity_category',
  {
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entity.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => category.id, { onDelete: 'cascade' }),
    isPrimary: boolean('is_primary').notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.entityId, t.categoryId] }),
    index('entity_category_category_idx').on(t.categoryId),
  ],
)

/**
 * Prices per service per business. Nothing in Macedonia publishes these,
 * which is exactly why they are the most citable thing on the site.
 */
export const entityService = pgTable(
  'entity_service',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entity.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => service.id, { onDelete: 'cascade' }),
    priceFrom: numeric('price_from', { precision: 10, scale: 2 }),
    priceTo: numeric('price_to', { precision: 10, scale: 2 }),
    currency: text('currency').notNull().default('MKD'),
    unit: text('unit'),
    note: text('note'),
    sourceId: uuid('source_id').references(() => source.id),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('entity_service_idx').on(t.entityId, t.serviceId)],
)

export const entityAttribute = pgTable(
  'entity_attribute',
  {
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entity.id, { onDelete: 'cascade' }),
    attributeId: uuid('attribute_id')
      .notNull()
      .references(() => attribute.id, { onDelete: 'cascade' }),
    value: text('value').notNull().default('true'),
    sourceId: uuid('source_id').references(() => source.id),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.entityId, t.attributeId] })],
)

export const openingHours = pgTable(
  'opening_hours',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entity.id, { onDelete: 'cascade' }),
    /** 1 = Monday ... 7 = Sunday, matching ISO-8601. */
    weekday: smallint('weekday').notNull(),
    opens: text('opens'),
    closes: text('closes'),
    closed: boolean('closed').notNull().default(false),
    /** Set for one-off exceptions (holidays); null for the weekly pattern. */
    exceptionDate: date('exception_date'),
    sourceId: uuid('source_id').references(() => source.id),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
  },
  (t) => [index('opening_hours_entity_idx').on(t.entityId)],
)

/** Our own reviews only. Third-party review text never lands here - see README. */
export const review = pgTable(
  'review',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entity.id, { onDelete: 'cascade' }),
    authorName: text('author_name'),
    rating: smallint('rating').notNull(),
    body: text('body'),
    language: lang('language').notNull().default('mk'),
    published: boolean('published').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('review_entity_idx').on(t.entityId)],
)

export const media = pgTable(
  'media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entity.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    kind: text('kind').notNull().default('photo'),
    credit: text('credit'),
    width: integer('width'),
    height: integer('height'),
    blurhash: text('blurhash'),
    sort: integer('sort').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('media_entity_idx').on(t.entityId)],
)

/* ==========================================================================
   Published lists and scoring
   ========================================================================== */

export const list = pgTable(
  'list',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    placeId: uuid('place_id')
      .notNull()
      .references(() => place.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => category.id, { onDelete: 'cascade' }),
    /** najdobri | ceni | otvoreno-vikend | <service slug> ... null = the hub. */
    modifier: text('modifier'),
    language: lang('language').notNull().default('mk'),
    titleMk: text('title_mk').notNull(),
    /**
     * The index gate, enforced in code and recorded here: a facet ships
     * noindex until it has >= 4 qualifying entities and a data dimension the
     * parent page does not already show.
     */
    isIndexable: boolean('is_indexable').notNull().default(false),
    gateReason: text('gate_reason'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // nullsNotDistinct is load-bearing, not a nicety. `modifier` is NULL for a
    // category's own page, and Postgres treats NULLs as distinct in a unique
    // index by default - so the upsert in buildList() would never find its
    // arbiter row and would insert a fresh duplicate on every rebuild, leaving
    // the page reading whichever copy came back first. Requires Postgres 15+.
    unique('list_idx')
      .on(t.placeId, t.categoryId, t.modifier, t.language)
      .nullsNotDistinct(),
  ],
)

export const listItem = pgTable(
  'list_item',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listId: uuid('list_id')
      .notNull()
      .references(() => list.id, { onDelete: 'cascade' }),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entity.id, { onDelete: 'cascade' }),
    rank: integer('rank').notNull(),
    scoreSnapshot: real('score_snapshot'),
    /** Paid placement. Rendered above the organic list, labelled Спонзорирано. */
    isSponsored: boolean('is_sponsored').notNull().default(false),
    sponsoredUntil: timestamp('sponsored_until', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('list_item_idx').on(t.listId, t.entityId),
    index('list_item_rank_idx').on(t.listId, t.rank),
  ],
)

/** Every score is reproducible and explainable, or the ranking is not defensible. */
export const scoreRun = pgTable(
  'score_run',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entity.id, { onDelete: 'cascade' }),
    total: real('total').notNull(),
    components: jsonb('components').$type<Record<string, number>>().notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('score_run_entity_idx').on(t.entityId, t.computedAt)],
)

/* ==========================================================================
   GEO monitoring - the query bank
   ========================================================================== */

export const query = pgTable(
  'query',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    text: text('text').notNull(),
    language: lang('language').notNull().default('mk'),
    placeId: uuid('place_id').references(() => place.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => category.id, { onDelete: 'cascade' }),
    /** discovery | comparison | price | logistics */
    intent: text('intent').notNull().default('discovery'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('query_text_idx').on(t.text, t.language)],
)

export const answerSnapshot = pgTable(
  'answer_snapshot',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    queryId: uuid('query_id')
      .notNull()
      .references(() => query.id, { onDelete: 'cascade' }),
    engine: aiEngine('engine').notNull(),
    model: text('model'),
    rawAnswer: text('raw_answer').notNull(),
    citedUrls: text('cited_urls').array().notNull().default(sql`'{}'::text[]`),
    runAt: timestamp('run_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('answer_snapshot_query_idx').on(t.queryId, t.engine, t.runAt)],
)

export const mention = pgTable(
  'mention',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    answerId: uuid('answer_id')
      .notNull()
      .references(() => answerSnapshot.id, { onDelete: 'cascade' }),
    entityId: uuid('entity_id').references(() => entity.id, { onDelete: 'set null' }),
    /** Whatever the model actually wrote, before entity resolution. */
    rawName: text('raw_name').notNull(),
    position: integer('position'),
    sentiment: text('sentiment'),
    /** Did the model cite aividi.mk as its source? The metric that matters. */
    citedUs: boolean('cited_us').notNull().default(false),
  },
  (t) => [index('mention_answer_idx').on(t.answerId), index('mention_entity_idx').on(t.entityId)],
)

/* ==========================================================================
   Commercial
   ========================================================================== */

export const account = pgTable(
  'account',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    name: text('name'),
    phone: text('phone'),
    passwordHash: text('password_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('account_email_idx').on(t.email)],
)

export const subscription = pgTable(
  'subscription',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entity.id, { onDelete: 'cascade' }),
    tier: tier('tier').notNull().default('free'),
    /** monthly | yearly - yearly is the realistic default here. */
    period: text('period').notNull().default('yearly'),
    status: subscriptionStatus('status').notNull().default('active'),
    priceEur: numeric('price_eur', { precision: 10, scale: 2 }),
    /** Bank transfer is the first payment rail; this is the фактура number. */
    invoiceRef: text('invoice_ref'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    renewsAt: timestamp('renews_at', { withTimezone: true }),
  },
  (t) => [index('subscription_entity_idx').on(t.entityId)],
)

export const lead = pgTable(
  'lead',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    categoryId: uuid('category_id').references(() => category.id),
    placeId: uuid('place_id').references(() => place.id),
    contactName: text('contact_name'),
    contactPhone: text('contact_phone'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    status: leadStatus('status').notNull().default('new'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('lead_category_idx').on(t.categoryId, t.createdAt)],
)

/** One lead goes to up to three providers; each delivery is billed separately. */
export const leadDelivery = pgTable(
  'lead_delivery',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => lead.id, { onDelete: 'cascade' }),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entity.id, { onDelete: 'cascade' }),
    priceEur: numeric('price_eur', { precision: 10, scale: 2 }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('lead_delivery_idx').on(t.leadId, t.entityId)],
)

/* ==========================================================================
   Operations
   ========================================================================== */

export const jobRun = pgTable(
  'job_run',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: text('kind').notNull(),
    status: jobStatus('status').notNull().default('running'),
    stats: jsonb('stats').$type<Record<string, unknown>>().notNull().default({}),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [index('job_run_kind_idx').on(t.kind, t.startedAt)],
)

/* ==========================================================================
   Inferred types
   ========================================================================== */

export type Source = typeof source.$inferSelect
export type SourceRecord = typeof sourceRecord.$inferSelect
export type Entity = typeof entity.$inferSelect
export type NewEntity = typeof entity.$inferInsert
export type EntityField = typeof entityField.$inferSelect
export type MatchCandidate = typeof matchCandidate.$inferSelect
export type Place = typeof place.$inferSelect
export type Category = typeof category.$inferSelect
export type ScoreRun = typeof scoreRun.$inferSelect
export type JobRun = typeof jobRun.$inferSelect

/* ==========================================================================
   Editorial articles

   A ranking article is not a blog post and not a rendered list — it is a list
   with an editorial layer on top. The businesses, prices, hours and scores
   come from the database, so an article can never drift out of date with the
   profiles it describes; what an editor adds is the part a database cannot
   produce: which entry wins WHICH question, why, and what to watch out for.

   One row per place x category, never one per year. The URL is durable and
   `updatedAt` moves — the pattern lyonsecret.com uses to keep a January 2025
   page ranking in August 2026 instead of splitting authority across annual
   duplicates.
   ========================================================================== */

export const articleStatus = pgEnum('article_status', ['draft', 'published'])

/** Bylines. A named person, because three of four reference sites attribute. */
export const author = pgTable('author', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  /** "Уредник" / "Соосновач" - shown beside the name, feeds Person.jobTitle. */
  role: text('role'),
  bio: text('bio'),
  url: text('url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const article = pgTable(
  'article',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    placeId: uuid('place_id')
      .notNull()
      .references(() => place.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => category.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id').references(() => author.id),
    language: lang('language').notNull().default('mk'),
    status: articleStatus('status').notNull().default('draft'),

    /** The H1. Carries no year - the year is appended to the <title> only. */
    headline: text('headline').notNull(),
    /** The sentence an assistant quotes. Answers the question immediately. */
    summary: text('summary').notNull(),
    /** Opening prose, above the comparison table. */
    intro: text('intro'),
    /** Closing prose, below the entries. */
    outro: text('outro'),

    /**
     * The wide image at the top. Unlike a business profile — where only
     * photographs of that business may appear — an article cover is about a
     * category in a town, so licensed or public-domain stock is honest here.
     */
    coverKey: text('cover_key'),
    coverCredit: text('cover_credit'),

    publishedAt: timestamp('published_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One durable article per place x category x language. Same reasoning as
    // list_idx: rebuilding must find this row rather than insert beside it.
    unique('article_scope_idx').on(t.placeId, t.categoryId, t.language),
    index('article_status_idx').on(t.status, t.updatedAt),
  ],
)

export const articleEntry = pgTable(
  'article_entry',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    articleId: uuid('article_id')
      .notNull()
      .references(() => article.id, { onDelete: 'cascade' }),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entity.id, { onDelete: 'cascade' }),
    rank: integer('rank').notNull(),
    /**
     * The superlative this entry owns: "најдобар за пица", "најдобар за
     * прослави". Unique within the article on purpose - every reference site
     * gives each entry its own question to win, and two entries competing for
     * one superlative is what makes a list read like filler.
     */
    role: text('role'),
    /** Why it earns the place. Editorial, in our own words. */
    verdict: text('verdict'),
    /** "Нашиот избор: лазањи" - the one thing to order or ask for. */
    pick: text('pick'),
    /** The honest caveat. The line that makes the rest believable. */
    warning: text('warning'),
    /**
     * A public Instagram or Facebook post to embed, the way lyonsecret.com
     * shows each restaurant. The post stays on their servers and keeps its
     * attribution and link back — which is what makes embedding legitimate
     * where re-hosting the same photo would not be.
     */
    embedUrl: text('embed_url'),
  },
  (t) => [
    unique('article_entry_idx').on(t.articleId, t.entityId),
    unique('article_role_idx').on(t.articleId, t.role).nullsNotDistinct(),
    index('article_entry_rank_idx').on(t.articleId, t.rank),
  ],
)

export const articleFaq = pgTable(
  'article_faq',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    articleId: uuid('article_id')
      .notNull()
      .references(() => article.id, { onDelete: 'cascade' }),
    sort: integer('sort').notNull().default(0),
    question: text('question').notNull(),
    answer: text('answer').notNull(),
  },
  (t) => [index('article_faq_idx').on(t.articleId, t.sort)],
)

export type Author = typeof author.$inferSelect
export type Article = typeof article.$inferSelect
export type ArticleEntry = typeof articleEntry.$inferSelect
export type ArticleFaq = typeof articleFaq.$inferSelect
