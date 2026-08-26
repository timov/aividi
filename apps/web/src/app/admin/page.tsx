import Link from 'next/link'
import {
  count,
  db,
  desc,
  entity,
  eq,
  isNull,
  jobRun,
  matchCandidate,
  raw,
  sourceRecord,
} from '@aividi/db'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  // Aggregate counters in one pass over entity; the queue depths are two
  // cheap index counts on top.
  const [stats] = await db
    .select({
      entities: raw<number>`count(*) filter (where status <> 'merged')::int`,
      published: raw<number>`count(*) filter (where status = 'published')::int`,
      drafts: raw<number>`count(*) filter (where status = 'draft')::int`,
      merged: raw<number>`count(*) filter (where status = 'merged')::int`,
      verified: raw<number>`count(*) filter (where verified_at is not null)::int`,
      withPhone: raw<number>`count(*) filter (where phone_e164 is not null)::int`,
      withCoords: raw<number>`count(*) filter (where lat is not null)::int`,
      avgScore: raw<number | null>`round(avg(score) filter (where score is not null))::int`,
    })
    .from(entity)

  const [pendingMatches] = await db
    .select({ n: count() })
    .from(matchCandidate)
    .where(eq(matchCandidate.decision, 'pending'))

  const [unprocessed] = await db
    .select({ n: count() })
    .from(sourceRecord)
    .where(isNull(sourceRecord.processedAt))

  const runs = await db.select().from(jobRun).orderBy(desc(jobRun.startedAt)).limit(8)

  const entities = stats?.entities ?? 0
  const verifiedPct = entities > 0 ? Math.round(((stats?.verified ?? 0) / entities) * 100) : 0

  return (
    <>
      <h1>Преглед</h1>
      <p className="sub">Состојба на графот и последни задачи.</p>

      <div className="tiles">
        <Tile value={entities} label="Субјекти (без споени)" />
        <Tile value={stats?.published ?? 0} label="Објавени" />
        <Tile value={stats?.drafts ?? 0} label="Нацрти" />
        <Tile value={`${verifiedPct}%`} label="Проверени" />
        <Tile value={pendingMatches?.n ?? 0} label="Чекаат спојување" />
        <Tile value={unprocessed?.n ?? 0} label="Необработени записи" />
      </div>

      <h2>Комплетност</h2>
      <div className="tiles">
        <Tile value={stats?.withPhone ?? 0} label="Со телефон" />
        <Tile value={stats?.withCoords ?? 0} label="Со координати" />
        <Tile value={stats?.avgScore ?? 0} label="Просечен AIVIDI Score" />
        <Tile value={stats?.merged ?? 0} label="Споени дупликати" />
      </div>

      {(pendingMatches?.n ?? 0) > 0 ? (
        <p style={{ marginTop: 18 }}>
          <Link href="/admin/matches">
            {pendingMatches?.n} пара чекаат одлука за спојување →
          </Link>
        </p>
      ) : null}

      <h2>Последни задачи</h2>
      <div className="panel tablewrap">
        {runs.length === 0 ? (
          <div className="empty">
            Сè уште нема извршени задачи. Почни од <Link href="/admin/sources">Извори</Link>.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Задача</th>
                <th>Статус</th>
                <th>Резултат</th>
                <th>Почеток</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td className="mono">{run.kind}</td>
                  <td>
                    <span
                      className={`pill ${
                        run.status === 'ok' ? 'good' : run.status === 'failed' ? 'bad' : 'warn'
                      }`}
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="mono muted">
                    {run.error ?? JSON.stringify(run.stats)}
                  </td>
                  <td className="num muted">{run.startedAt.toISOString().slice(0, 16)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

function Tile({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="tile">
      <div className="v">{value}</div>
      <div className="k">{label}</div>
    </div>
  )
}
