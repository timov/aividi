'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  and,
  article,
  articleEntry,
  articleFaq,
  db,
  desc,
  entity,
  entityAttribute,
  entityCategory,
  eq,
  media,
  openingHours,
  source,
} from '@aividi/db'
import {
  applyFields,
  markVerified,
  materializeEntity,
  mergeEntities,
  rejectMatch,
  score,
  type FieldKey,
} from '@aividi/pipeline'
import { enqueue } from '@aividi/pipeline/queue'
import {
  matchKey,
  normalizeAddress,
  normalizeMkPhone,
  normalizeUrl,
  socialHandle,
  toLatin,
} from '@aividi/core'
import { ADMIN_ACTOR, requireAdmin, signOut } from '@/lib/auth'
import { normalise } from '@/components/SocialEmbed'

/**
 * Every action re-checks auth. A server action is its own endpoint - the
 * layout's check does not cover it.
 */

async function manualSourceId(): Promise<string> {
  const [row] = await db
    .select({ id: source.id })
    .from(source)
    .where(eq(source.kind, 'manual'))
    .limit(1)
  if (!row) throw new Error('No "manual" source seeded - run pnpm db:seed')
  return row.id
}

export async function mergeAction(formData: FormData) {
  await requireAdmin()
  const winnerId = String(formData.get('winnerId'))
  const loserId = String(formData.get('loserId'))
  await mergeEntities(winnerId, loserId, ADMIN_ACTOR)
  await score(winnerId)
  revalidatePath('/admin/matches')
  revalidatePath('/admin/entities')
}

export async function rejectAction(formData: FormData) {
  await requireAdmin()
  await rejectMatch(String(formData.get('candidateId')), ADMIN_ACTOR)
  revalidatePath('/admin/matches')
}

export async function setStatusAction(formData: FormData) {
  await requireAdmin()
  const entityId = String(formData.get('entityId'))
  const status = String(formData.get('status')) as 'draft' | 'review' | 'published' | 'closed'
  await db
    .update(entity)
    .set({ status, updatedAt: new Date() })
    .where(eq(entity.id, entityId))
  revalidatePath(`/admin/entities/${entityId}`)
  revalidatePath('/admin/entities')
}

export async function verifyAction(formData: FormData) {
  await requireAdmin()
  const entityId = String(formData.get('entityId'))
  await markVerified(entityId, ADMIN_ACTOR, await manualSourceId())
  await score(entityId)
  revalidatePath(`/admin/entities/${entityId}`)
}

/**
 * A hand-typed correction. It does not overwrite anything - it lands as a
 * candidate from the "manual" source at full confidence, which then wins
 * resolution. The value it displaced is still there, and still explainable.
 */
export async function overrideFieldAction(formData: FormData) {
  await requireAdmin()
  const entityId = String(formData.get('entityId'))
  const key = String(formData.get('key')) as FieldKey
  const value = String(formData.get('value') ?? '').trim()

  await applyFields({
    entityId,
    sourceId: await manualSourceId(),
    fields: { [key]: value || null },
    confidence: 1,
    verifiedAt: new Date(),
  })

  await materializeEntity(entityId)
  await score(entityId)
  revalidatePath(`/admin/entities/${entityId}`)
}

/**
 * Attaches the business's own logo or cover image.
 *
 * Both are singular, so setting one replaces whatever was there — a business
 * has one mark and one banner, and a stale second row would just race the new
 * one for the same slot. An empty value clears the slot instead.
 *
 * The value is a URL or a filename under /uploads; we deliberately do not
 * fetch and re-host it here, because whoever pastes it is asserting they may
 * use it, and that assertion belongs with a person rather than with a crawler.
 */
export async function setMediaAction(formData: FormData) {
  await requireAdmin()
  const entityId = String(formData.get('entityId'))
  const kind = String(formData.get('kind'))
  if (kind !== 'logo' && kind !== 'cover') throw new Error(`unsupported media kind: ${kind}`)

  const key = String(formData.get('key') ?? '').trim()
  const credit = String(formData.get('credit') ?? '').trim()

  await db.delete(media).where(and(eq(media.entityId, entityId), eq(media.kind, kind)))
  if (key) {
    await db.insert(media).values({ entityId, key, kind, credit: credit || null, sort: 0 })
  }

  revalidatePath(`/admin/entities/${entityId}`)
}

export async function rescoreAction(formData: FormData) {
  await requireAdmin()
  const entityId = String(formData.get('entityId'))
  await materializeEntity(entityId)
  await score(entityId)
  revalidatePath(`/admin/entities/${entityId}`)
}

/** Queues an ingest run. Needs Redis and a running worker. */
export async function ingestAction(formData: FormData) {
  await requireAdmin()
  const sourceId = String(formData.get('sourceId'))
  const rawLimit = String(formData.get('limit') ?? '')
  const limit = rawLimit ? Number(rawLimit) : undefined
  await enqueue('ingest', { sourceId, limit: Number.isFinite(limit) ? limit : undefined })
  revalidatePath('/admin/sources')
}

/* ---- entities ------------------------------------------------------------ */

/**
 * One form, everything a business profile can hold — the manual counterpart
 * to `attach()` in the ingestion pipeline (packages/pipeline/src/promote.ts).
 * Typed by an admin rather than scraped, so it lands as the "manual" source
 * at full confidence and is marked verified immediately - the same trust an
 * override on an existing entity already gets, just for every field at once.
 */
export async function createEntityAction(formData: FormData) {
  await requireAdmin()

  const text = (k: string) => {
    const v = String(formData.get(k) ?? '').trim()
    return v || null
  }
  const num = (k: string) => {
    const v = String(formData.get(k) ?? '').trim()
    if (!v) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  const nameMk = text('nameMk')
  const placeId = text('placeId')
  if (!nameMk || !placeId) throw new Error('Име и место се задолжителни')

  const statusInput = String(formData.get('status') ?? 'draft')
  const status = (['draft', 'review', 'published'] as const).find((s) => s === statusInput) ?? 'draft'

  const sourceId = await manualSourceId()
  const now = new Date()

  const [created] = await db
    .insert(entity)
    .values({
      status,
      nameMk,
      nameLat: toLatin(nameMk),
      nameNorm: matchKey(nameMk),
      placeId,
    })
    .returning({ id: entity.id })

  if (!created) throw new Error('failed to create entity')
  const entityId = created.id

  const fields: Partial<Record<FieldKey, string | number | null>> = {
    name_mk: nameMk,
    name_sq: text('nameSq'),
    legal_name: text('legalName'),
    embs: text('embs'),
    edb: text('edb'),
    address: text('address'),
    lat: num('lat'),
    lng: num('lng'),
    phone_e164: normalizeMkPhone(text('phoneE164')),
    email: text('email'),
    website: normalizeUrl(text('website')),
    facebook: socialHandle(text('facebook'), 'facebook'),
    instagram: socialHandle(text('instagram'), 'instagram'),
    description_mk: text('descriptionMk'),
    summary_mk: text('summaryMk'),
  }

  await applyFields({ entityId, sourceId, fields, confidence: 1, verifiedAt: now })

  // Not sourced fields: price level has no provenance, and addressNorm is a
  // derived column materializeEntity never touches (see promote.ts's attach()).
  const priceLevel = num('priceLevel')
  const addressNorm = normalizeAddress(text('address'))
  if (priceLevel != null || addressNorm) {
    await db
      .update(entity)
      .set({
        ...(priceLevel != null ? { priceLevel } : {}),
        ...(addressNorm ? { addressNorm } : {}),
      })
      .where(eq(entity.id, entityId))
  }

  const categoryIds = formData.getAll('categoryId').map(String).filter(Boolean)
  const primaryFromForm = String(formData.get('primaryCategoryId') ?? '')
  const primaryCategoryId = categoryIds.includes(primaryFromForm) ? primaryFromForm : categoryIds[0]
  for (const categoryId of categoryIds) {
    await db
      .insert(entityCategory)
      .values({ entityId, categoryId, isPrimary: categoryId === primaryCategoryId })
      .onConflictDoNothing()
  }

  const attributeIds = formData.getAll('attributeId').map(String).filter(Boolean)
  for (const attributeId of attributeIds) {
    await db
      .insert(entityAttribute)
      .values({ entityId, attributeId, value: 'true', sourceId, verifiedAt: now })
      .onConflictDoNothing()
  }

  for (let day = 1; day <= 7; day++) {
    const closed = formData.get(`hoursClosed${day}`) === 'on'
    const opens = text(`hoursOpens${day}`)
    const closes = text(`hoursCloses${day}`)
    if (!closed && !opens && !closes) continue
    await db.insert(openingHours).values({
      entityId,
      weekday: day,
      opens: closed ? null : opens,
      closes: closed ? null : closes,
      closed,
      sourceId,
      verifiedAt: now,
    })
  }

  const logoKey = text('logoKey')
  if (logoKey) {
    await db
      .insert(media)
      .values({ entityId, key: logoKey, kind: 'logo', credit: text('logoCredit'), sort: 0 })
  }
  const coverKey = text('coverKey')
  if (coverKey) {
    await db
      .insert(media)
      .values({ entityId, key: coverKey, kind: 'cover', credit: text('coverCredit'), sort: 0 })
  }

  await markVerified(entityId, ADMIN_ACTOR, sourceId)
  await score(entityId)

  revalidatePath('/admin/entities')
  redirect(`/admin/entities/${entityId}`)
}

export async function logoutAction() {
  await signOut()
  redirect('/login')
}

/* ---- articles ------------------------------------------------------------ */

/**
 * The editorial fields, and only those. Businesses, prices and hours are never
 * writable here — they belong to the profiles, and an article that carried its
 * own copy would start drifting the moment one changed.
 */
export async function saveArticleAction(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id'))

  const text = (k: string) => {
    const v = String(formData.get(k) ?? '').trim()
    return v || null
  }

  await db
    .update(article)
    .set({
      headline: String(formData.get('headline') ?? '').trim(),
      summary: String(formData.get('summary') ?? '').trim(),
      intro: text('intro'),
      outro: text('outro'),
      coverKey: text('coverKey'),
      coverCredit: text('coverCredit'),
      updatedAt: new Date(),
    })
    .where(eq(article.id, id))

  revalidatePath(`/admin/articles/${id}`)
  revalidatePath('/vodic')
}

export async function saveArticleEntryAction(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('entryId'))
  const articleId = String(formData.get('id'))

  const text = (k: string) => {
    const v = String(formData.get(k) ?? '').trim()
    return v || null
  }

  await db
    .update(articleEntry)
    .set({
      role: text('role'),
      verdict: text('verdict'),
      pick: text('pick'),
      warning: text('warning'),
      // Validated on render too, but rejecting it here keeps anything that is
      // not an Instagram post permalink out of the database in the first place.
      embedUrl: normalise(String(formData.get('embedUrl') ?? '')),
    })
    .where(eq(articleEntry.id, id))

  await db.update(article).set({ updatedAt: new Date() }).where(eq(article.id, articleId))
  revalidatePath(`/admin/articles/${articleId}`)
}

export async function addFaqAction(formData: FormData) {
  await requireAdmin()
  const articleId = String(formData.get('id'))
  const question = String(formData.get('question') ?? '').trim()
  const answer = String(formData.get('answer') ?? '').trim()
  if (!question || !answer) return

  const [last] = await db
    .select({ sort: articleFaq.sort })
    .from(articleFaq)
    .where(eq(articleFaq.articleId, articleId))
    .orderBy(desc(articleFaq.sort))
    .limit(1)

  await db
    .insert(articleFaq)
    .values({ articleId, question, answer, sort: (last?.sort ?? -1) + 1 })

  revalidatePath(`/admin/articles/${articleId}`)
}

export async function deleteFaqAction(formData: FormData) {
  await requireAdmin()
  const articleId = String(formData.get('id'))
  await db.delete(articleFaq).where(eq(articleFaq.id, String(formData.get('faqId'))))
  revalidatePath(`/admin/articles/${articleId}`)
}

/**
 * Publishing stamps publishedAt once and never again — that first date is the
 * one the Article schema reports, while updatedAt keeps moving. One durable
 * URL that gets re-dated is the whole point.
 */
export async function setArticleStatusAction(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id'))
  const status = String(formData.get('status')) as 'draft' | 'published'

  const [current] = await db
    .select({ publishedAt: article.publishedAt })
    .from(article)
    .where(eq(article.id, id))
    .limit(1)

  await db
    .update(article)
    .set({
      status,
      updatedAt: new Date(),
      publishedAt:
        status === 'published' && !current?.publishedAt ? new Date() : (current?.publishedAt ?? null),
    })
    .where(eq(article.id, id))

  revalidatePath(`/admin/articles/${id}`)
  revalidatePath('/vodic')
}
