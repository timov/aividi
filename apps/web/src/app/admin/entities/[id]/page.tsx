import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  and,
  attribute,
  category,
  db,
  desc,
  entity,
  entityAttribute,
  entityCategory,
  entityField,
  eq,
  media,
  openingHours,
  place,
  scoreRun,
  source,
  sourceRecord,
} from '@aividi/db'
import { effectiveWeight, SCORE_LABELS, SCORE_WEIGHTS } from '@aividi/core'
import {
  overrideFieldAction,
  rescoreAction,
  setMediaAction,
  setStatusAction,
  verifyAction,
} from '../../actions'

export const dynamic = 'force-dynamic'

/** Fields a human can correct by hand. Must match FIELD_COLUMNS in the pipeline. */
const EDITABLE: Array<[key: string, label: string]> = [
  ['name_mk', 'Име'],
  ['phone_e164', 'Телефон'],
  ['address', 'Адреса'],
  ['website', 'Веб-страница'],
  ['facebook', 'Facebook'],
  ['instagram', 'Instagram'],
  ['email', 'Е-пошта'],
  ['embs', 'ЕМБС'],
  ['edb', 'ЕДБ'],
  ['description_mk', 'Опис'],
  ['lat', 'Гео. ширина'],
  ['lng', 'Гео. должина'],
]

const WEEKDAYS = ['', 'Пон', 'Вто', 'Сре', 'Чет', 'Пет', 'Саб', 'Нед']

export default async function EntityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [row] = await db
    .select({ e: entity, placeName: place.nameMk })
    .from(entity)
    .leftJoin(place, eq(place.id, entity.placeId))
    .where(eq(entity.id, id))
    .limit(1)

  if (!row) notFound()
  const e = row.e

  const mediaRows = await db
    .select({ kind: media.kind, key: media.key, credit: media.credit })
    .from(media)
    .where(eq(media.entityId, id))

  const logo = mediaRows.find((m) => m.kind === 'logo')
  const cover = mediaRows.find((m) => m.kind === 'cover')

  const fields = await db
    .select({
      key: entityField.key,
      value: entityField.value,
      confidence: entityField.confidence,
      verifiedAt: entityField.verifiedAt,
      updatedAt: entityField.updatedAt,
      sourceId: entityField.sourceId,
      sourceName: source.name,
      sourceKind: source.kind,
      trust: source.trust,
      licence: source.licence,
    })
    .from(entityField)
    .innerJoin(source, eq(source.id, entityField.sourceId))
    .where(eq(entityField.entityId, id))
    .orderBy(entityField.key, desc(source.trust))

  const [latestScore] = await db
    .select()
    .from(scoreRun)
    .where(eq(scoreRun.entityId, id))
    .orderBy(desc(scoreRun.computedAt))
    .limit(1)

  const cats = await db
    .select({ name: category.nameMk, isPrimary: entityCategory.isPrimary })
    .from(entityCategory)
    .innerJoin(category, eq(category.id, entityCategory.categoryId))
    .where(eq(entityCategory.entityId, id))

  const attrs = await db
    .select({ name: attribute.nameMk })
    .from(entityAttribute)
    .innerJoin(attribute, eq(attribute.id, entityAttribute.attributeId))
    .where(eq(entityAttribute.entityId, id))

  const hours = await db
    .select()
    .from(openingHours)
    .where(and(eq(openingHours.entityId, id)))
    .orderBy(openingHours.weekday)

  const records = await db
    .select({
      id: sourceRecord.id,
      externalId: sourceRecord.externalId,
      fetchedAt: sourceRecord.fetchedAt,
      sourceName: source.name,
      licence: source.licence,
    })
    .from(sourceRecord)
    .innerJoin(source, eq(source.id, sourceRecord.sourceId))
    .where(eq(sourceRecord.entityId, id))
    .orderBy(desc(sourceRecord.fetchedAt))

  // Group field candidates by key and mark the one that currently wins.
  const byKey = new Map<string, typeof fields>()
  for (const f of fields) {
    const list = byKey.get(f.key) ?? []
    list.push(f)
    byKey.set(f.key, list)
  }

  const components = (latestScore?.components ?? {}) as Record<string, number>

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h1>{e.nameMk}</h1>
          <p className="sub">
            <span className="mono">{e.slug ?? 'без slug'}</span> · {row.placeName ?? 'без место'} ·{' '}
            <span className={`pill ${e.status === 'published' ? 'good' : 'warn'}`}>{e.status}</span>
            {e.verifiedAt ? (
              <>
                {' '}
                <span className="pill good">
                  проверен {e.verifiedAt.toISOString().slice(0, 10)}
                </span>
              </>
            ) : (
              <>
                {' '}
                <span className="pill bad">непроверен</span>
              </>
            )}
          </p>
        </div>
        <div className="row">
          <form action={verifyAction}>
            <input type="hidden" name="entityId" value={e.id} />
            <button type="submit">Означи како проверен</button>
          </form>
          <form action={setStatusAction}>
            <input type="hidden" name="entityId" value={e.id} />
            <input
              type="hidden"
              name="status"
              value={e.status === 'published' ? 'draft' : 'published'}
            />
            <button type="submit" className="primary">
              {e.status === 'published' ? 'Врати во нацрт' : 'Објави'}
            </button>
          </form>
          <form action={rescoreAction}>
            <input type="hidden" name="entityId" value={e.id} />
            <button type="submit" className="ghost">
              Пресметај повторно
            </button>
          </form>
        </div>
      </div>

      {/* ---- score breakdown ------------------------------------------- */}
      <h2>AIVIDI Score: {e.score ?? '—'}</h2>
      <div className="panel panel-pad">
        {latestScore ? (
          <table>
            <tbody>
              {(Object.keys(SCORE_WEIGHTS) as Array<keyof typeof SCORE_WEIGHTS>).map((k) => {
                const got = components[k] ?? 0
                const max = SCORE_WEIGHTS[k]
                return (
                  <tr key={k}>
                    <td style={{ width: 220 }}>{SCORE_LABELS[k]}</td>
                    <td className="num" style={{ width: 90 }}>
                      {got} / {max}
                    </td>
                    <td>
                      <div className="bar">
                        <span style={{ width: `${(got / max) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <span className="muted">Сè уште не е пресметан.</span>
        )}
      </div>

      {/* ---- provenance ------------------------------------------------- */}
      <h2>Податоци и потекло</h2>
      <p className="sub">
        Секое поле ги прикажува сите вредности што сме ги добиле. Победничката е болдирана.
        Рачната исправка не брише ништо - влегува како извор „Рачен внес“ со полна доверба.
      </p>

      <div className="stack">
        {EDITABLE.map(([key, label]) => {
          const candidates = byKey.get(key) ?? []
          const winner =
            candidates.length > 0
              ? candidates.reduce((best, c) =>
                  effectiveWeight(c) > effectiveWeight(best) ? c : best,
                )
              : null

          return (
            <div key={key} className="panel">
              <div className="panel-pad row" style={{ justifyContent: 'space-between' }}>
                <strong>{label}</strong>
                <form action={overrideFieldAction} className="row">
                  <input type="hidden" name="entityId" value={e.id} />
                  <input type="hidden" name="key" value={key} />
                  <input
                    name="value"
                    defaultValue={winner?.value ?? ''}
                    placeholder="празно = избриши"
                    style={{ width: 260 }}
                  />
                  <button type="submit">Зачувај</button>
                </form>
              </div>
              {candidates.length > 0 ? (
                <div className="tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Вредност</th>
                        <th>Извор</th>
                        <th className="num">Доверба</th>
                        <th className="num">Тежина</th>
                        <th>Проверено</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candidates.map((c) => (
                        <tr key={`${c.key}-${c.sourceId}`}>
                          <td style={{ fontWeight: c === winner ? 700 : 400 }}>{c.value}</td>
                          <td className="muted">
                            {c.sourceName}
                            {c.licence ? (
                              <div className="mono" style={{ fontSize: 11 }}>
                                {c.licence}
                              </div>
                            ) : null}
                          </td>
                          <td className="num">{c.confidence.toFixed(2)}</td>
                          <td className="num">{effectiveWeight(c).toFixed(3)}</td>
                          <td className="num muted">
                            {c.verifiedAt ? c.verifiedAt.toISOString().slice(0, 10) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="panel-pad muted">Нема податок од ниту еден извор.</div>
              )}
            </div>
          )
        })}
      </div>

      {/* ---- imagery ------------------------------------------------------ */}
      <h2>Лого и насловна фотографија</h2>
      <div className="panel panel-pad">
        <p className="muted" style={{ marginTop: 0 }}>
          Полн URL или име на датотека од <code>/public/uploads</code>. Само материјал од самиот
          бизнис — лого од нивниот сајт, фотографија од нивниот објект. Празно поле го брише.
        </p>
        {(
          [
            ['logo', 'Лого', logo, 'logo.png или https://example.mk/logo.png'],
            ['cover', 'Насловна', cover, 'cover.jpg или https://example.mk/foto.jpg'],
          ] as const
        ).map(([kind, label, row, hint]) => (
          <form key={kind} action={setMediaAction} className="media-row">
            <input type="hidden" name="entityId" value={e.id} />
            <input type="hidden" name="kind" value={kind} />
            <div className={`media-preview media-preview-${kind}`}>
              {row ? <img src={toPreview(row.key)} alt="" /> : <span className="muted">—</span>}
            </div>
            <label className="media-fields">
              <b>{label}</b>
              <input name="key" defaultValue={row?.key ?? ''} placeholder={hint} />
              <input
                name="credit"
                defaultValue={row?.credit ?? ''}
                placeholder="Извор / автор (по потреба)"
              />
            </label>
            <button className="btn">Зачувај</button>
          </form>
        ))}
      </div>

      {/* ---- classification --------------------------------------------- */}
      <h2>Категории и атрибути</h2>
      <div className="panel panel-pad">
        <div className="row">
          {cats.length === 0 ? <span className="muted">Без категорија.</span> : null}
          {cats.map((c) => (
            <span key={c.name} className={`pill ${c.isPrimary ? 'good' : ''}`}>
              {c.name}
              {c.isPrimary ? ' ·  примарна' : ''}
            </span>
          ))}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          {attrs.length === 0 ? <span className="muted">Без атрибути.</span> : null}
          {attrs.map((a) => (
            <span key={a.name} className="pill">
              {a.name}
            </span>
          ))}
        </div>
      </div>

      {/* ---- hours ------------------------------------------------------- */}
      <h2>Работно време</h2>
      <div className="panel panel-pad">
        {hours.length === 0 ? (
          <span className="muted">Нема податок.</span>
        ) : (
          <div className="row">
            {hours.map((h) => (
              <span key={h.id} className="pill">
                {WEEKDAYS[h.weekday]} {h.closed ? 'затворено' : `${h.opens}–${h.closes}`}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ---- raw records -------------------------------------------------- */}
      <h2>Извори на записи</h2>
      <div className="panel tablewrap">
        {records.length === 0 ? (
          <div className="empty">Нема поврзани сурови записи.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Извор</th>
                <th>Надворешен ID</th>
                <th>Преземено</th>
                <th>Лиценца</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{r.sourceName}</td>
                  <td className="mono">{r.externalId}</td>
                  <td className="num muted">{r.fetchedAt.toISOString().slice(0, 16)}</td>
                  <td className="muted mono" style={{ fontSize: 11 }}>
                    {r.licence ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p style={{ marginTop: 20 }}>
        <Link href="/admin/entities">← назад кон списокот</Link>
      </p>
    </>
  )
}

/** Same mapping the public pages use: absolute stays, bare names are uploads. */
function toPreview(key: string): string {
  if (/^https?:\/\//.test(key)) return key
  if (key.startsWith('logos/')) return `/${key}`
  return key.startsWith('/') ? key : `/uploads/${key}`
}
