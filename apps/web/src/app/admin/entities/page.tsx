import Link from 'next/link'
import {
  and,
  category,
  count,
  db,
  desc,
  entity,
  entityCategory,
  eq,
  ilike,
  ne,
  or,
  place,
} from '@aividi/db'
import { matchKey } from '@aividi/core'

export const dynamic = 'force-dynamic'

const STATUSES = ['draft', 'review', 'published', 'closed'] as const

export default async function EntitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; cat?: string; page?: string }>
}) {
  const params = await searchParams
  const q = params.q?.trim() ?? ''
  const status = params.status ?? ''
  const cat = params.cat ?? ''
  const page = Math.max(1, Number(params.page ?? 1) || 1)
  const perPage = 50

  const categories = await db
    .select({ slug: category.slug, name: category.nameMk })
    .from(category)
    .where(eq(category.isPilot, true))
    .orderBy(category.sort)

  const filters = [ne(entity.status, 'merged')]

  if (q) {
    // Search both the raw name and the folded key, so "Kaj Mire" finds
    // "Кај Мире" without the user thinking about scripts.
    filters.push(
      or(
        ilike(entity.nameMk, `%${q}%`),
        ilike(entity.nameLat, `%${q}%`),
        ilike(entity.nameNorm, `%${matchKey(q)}%`),
        ilike(entity.phoneE164, `%${q.replace(/\D/g, '')}%`),
      )!,
    )
  }
  if (status) filters.push(eq(entity.status, status as (typeof STATUSES)[number]))

  const base = db
    .select({
      id: entity.id,
      name: entity.nameMk,
      status: entity.status,
      score: entity.score,
      phone: entity.phoneE164,
      verifiedAt: entity.verifiedAt,
      place: place.nameMk,
      categoryName: category.nameMk,
    })
    .from(entity)
    .leftJoin(place, eq(place.id, entity.placeId))
    .leftJoin(
      entityCategory,
      and(eq(entityCategory.entityId, entity.id), eq(entityCategory.isPrimary, true)),
    )
    .leftJoin(category, eq(category.id, entityCategory.categoryId))

  if (cat) filters.push(eq(category.slug, cat))

  const rows = await base
    .where(and(...filters))
    .orderBy(desc(entity.score), desc(entity.createdAt))
    .limit(perPage)
    .offset((page - 1) * perPage)

  const [total] = await db
    .select({ n: count() })
    .from(entity)
    .leftJoin(
      entityCategory,
      and(eq(entityCategory.entityId, entity.id), eq(entityCategory.isPrimary, true)),
    )
    .leftJoin(category, eq(category.id, entityCategory.categoryId))
    .where(and(...filters))

  const pages = Math.ceil((total?.n ?? 0) / perPage)

  return (
    <>
      <h1>Субјекти</h1>
      <p className="sub">{total?.n ?? 0} субјекти (споените се исклучени).</p>

      <form className="panel panel-pad row" style={{ marginBottom: 14 }}>
        <input name="q" defaultValue={q} placeholder="Име или телефон" />
        <select name="status" defaultValue={status}>
          <option value="">сите статуси</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select name="cat" defaultValue={cat}>
          <option value="">сите категории</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit">Филтрирај</button>
      </form>

      <div className="panel tablewrap">
        {rows.length === 0 ? (
          <div className="empty">Нема резултати.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Име</th>
                <th>Категорија</th>
                <th>Место</th>
                <th>Телефон</th>
                <th>Статус</th>
                <th className="num">Score</th>
                <th>Проверен</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/admin/entities/${row.id}`}>{row.name}</Link>
                  </td>
                  <td className="muted">{row.categoryName ?? '—'}</td>
                  <td className="muted">{row.place ?? '—'}</td>
                  <td className="mono">{row.phone ?? '—'}</td>
                  <td>
                    <span
                      className={`pill ${
                        row.status === 'published' ? 'good' : row.status === 'draft' ? 'warn' : ''
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="num">{row.score ?? '—'}</td>
                  <td className="num muted">
                    {row.verifiedAt ? row.verifiedAt.toISOString().slice(0, 10) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 ? (
        <div className="row" style={{ marginTop: 12 }}>
          {page > 1 ? (
            <Link
              className="btn"
              href={`/admin/entities?${new URLSearchParams({ q, status, cat, page: String(page - 1) })}`}
            >
              ← претходна
            </Link>
          ) : null}
          <span className="muted">
            {page} / {pages}
          </span>
          {page < pages ? (
            <Link
              className="btn"
              href={`/admin/entities?${new URLSearchParams({ q, status, cat, page: String(page + 1) })}`}
            >
              следна →
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
