import Link from 'next/link'
import { alias, db, desc, entity, eq, matchCandidate, place } from '@aividi/db'
import { mergeAction, rejectAction } from '../actions'

export const dynamic = 'force-dynamic'

/**
 * The merge queue.
 *
 * Everything the matcher could not decide on a strong identifier lands here.
 * The reviewer needs one thing above all: to see, side by side, exactly which
 * fields agree and which do not - so differing values are highlighted rather
 * than left to be spotted.
 */
export default async function MatchesPage() {
  const left = alias(entity, 'l')
  const right = alias(entity, 'r')
  const leftPlace = alias(place, 'lp')
  const rightPlace = alias(place, 'rp')

  const rows = await db
    .select({
      id: matchCandidate.id,
      score: matchCandidate.score,
      features: matchCandidate.features,
      left: {
        id: left.id,
        name: left.nameMk,
        phone: left.phoneE164,
        address: left.address,
        website: left.website,
        embs: left.embs,
        status: left.status,
        entityScore: left.score,
        lat: left.lat,
        lng: left.lng,
        createdAt: left.createdAt,
      },
      right: {
        id: right.id,
        name: right.nameMk,
        phone: right.phoneE164,
        address: right.address,
        website: right.website,
        embs: right.embs,
        status: right.status,
        entityScore: right.score,
        lat: right.lat,
        lng: right.lng,
        createdAt: right.createdAt,
      },
      leftPlace: leftPlace.nameMk,
      rightPlace: rightPlace.nameMk,
    })
    .from(matchCandidate)
    .innerJoin(left, eq(left.id, matchCandidate.leftEntityId))
    .innerJoin(right, eq(right.id, matchCandidate.rightEntityId))
    .leftJoin(leftPlace, eq(leftPlace.id, left.placeId))
    .leftJoin(rightPlace, eq(rightPlace.id, right.placeId))
    .where(eq(matchCandidate.decision, 'pending'))
    .orderBy(desc(matchCandidate.score))
    .limit(40)

  return (
    <>
      <h1>Спојувања</h1>
      <p className="sub">
        Парови што матчерот не можел да ги реши со силен клуч. Најсигурните се на врвот.
      </p>

      {rows.length === 0 ? (
        <div className="panel empty">Нема парови за одлука. 🎉</div>
      ) : (
        <div className="stack">
          {rows.map((row) => {
            const features = row.features as Record<string, number | boolean | null>
            const distance =
              typeof features.distanceM === 'number' ? Math.round(features.distanceM) : null

            return (
              <div key={row.id} className="panel">
                <div
                  className="panel-pad row"
                  style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--rule)' }}
                >
                  <div className="row">
                    <strong>{Math.round(row.score * 100)}% совпаѓање</strong>
                    {features.phoneEqual ? <span className="pill good">ист телефон</span> : null}
                    {features.websiteEqual ? <span className="pill good">ист домен</span> : null}
                    {features.embsEqual ? <span className="pill good">ист ЕМБС</span> : null}
                    {distance !== null ? (
                      <span className="pill">{distance} m растојание</span>
                    ) : null}
                    {typeof features.nameSim === 'number' ? (
                      <span className="pill">
                        име {Math.round(features.nameSim * 100)}%
                      </span>
                    ) : null}
                  </div>
                  <form action={rejectAction}>
                    <input type="hidden" name="candidateId" value={row.id} />
                    <button type="submit" className="ghost">
                      Различни се
                    </button>
                  </form>
                </div>

                <Compare label="Име" a={row.left.name} b={row.right.name} />
                <Compare label="Телефон" a={row.left.phone} b={row.right.phone} />
                <Compare label="Адреса" a={row.left.address} b={row.right.address} />
                <Compare label="Место" a={row.leftPlace} b={row.rightPlace} />
                <Compare label="Веб" a={row.left.website} b={row.right.website} />
                <Compare label="ЕМБС" a={row.left.embs} b={row.right.embs} />
                <Compare
                  label="Координати"
                  a={row.left.lat ? `${row.left.lat.toFixed(5)}, ${row.left.lng?.toFixed(5)}` : null}
                  b={
                    row.right.lat ? `${row.right.lat.toFixed(5)}, ${row.right.lng?.toFixed(5)}` : null
                  }
                />
                <Compare
                  label="Статус / Score"
                  a={`${row.left.status} · ${row.left.entityScore ?? '-'}`}
                  b={`${row.right.status} · ${row.right.entityScore ?? '-'}`}
                />

                <div className="compare">
                  <div className="label" style={{ borderBottom: 0 }}>
                    Одлука
                  </div>
                  <div style={{ borderBottom: 0 }}>
                    <form action={mergeAction}>
                      <input type="hidden" name="winnerId" value={row.left.id} />
                      <input type="hidden" name="loserId" value={row.right.id} />
                      <div className="row">
                        <button type="submit" className="primary">
                          Задржи го левиот
                        </button>
                        <Link href={`/admin/entities/${row.left.id}`} className="muted">
                          отвори
                        </Link>
                      </div>
                    </form>
                  </div>
                  <div style={{ borderBottom: 0 }}>
                    <form action={mergeAction}>
                      <input type="hidden" name="winnerId" value={row.right.id} />
                      <input type="hidden" name="loserId" value={row.left.id} />
                      <div className="row">
                        <button type="submit" className="primary">
                          Задржи го десниот
                        </button>
                        <Link href={`/admin/entities/${row.right.id}`} className="muted">
                          отвори
                        </Link>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function Compare({
  label,
  a,
  b,
}: {
  label: string
  a: string | null | undefined
  b: string | null | undefined
}) {
  const differs = (a ?? '') !== (b ?? '')
  return (
    <div className="compare">
      <div className="label">{label}</div>
      <div className={differs ? 'differs' : ''}>{a ?? <span className="muted">—</span>}</div>
      <div className={differs ? 'differs' : ''}>{b ?? <span className="muted">—</span>}</div>
    </div>
  )
}
