import { count, db, desc, eq, jobRun, source, sourceRecord } from '@aividi/db'
import { hasAdapter } from '@aividi/pipeline'
import { ingestAction } from '../actions'

export const dynamic = 'force-dynamic'

export default async function SourcesPage() {
  const sources = await db.select().from(source).orderBy(desc(source.trust))

  const counts = await db
    .select({ sourceId: sourceRecord.sourceId, n: count() })
    .from(sourceRecord)
    .groupBy(sourceRecord.sourceId)

  const countBySource = new Map(counts.map((c) => [c.sourceId, c.n]))

  const runs = await db
    .select()
    .from(jobRun)
    .where(eq(jobRun.status, 'failed'))
    .orderBy(desc(jobRun.startedAt))
    .limit(5)

  return (
    <>
      <h1>Извори</h1>
      <p className="sub">
        Довербата (trust) го одредува кој извор победува при спротивставени вредности.
        Сопственикот и рачниот внес секогаш бијат автоматски извор.
      </p>

      <div className="panel tablewrap">
        <table>
          <thead>
            <tr>
              <th>Извор</th>
              <th className="num">Trust</th>
              <th className="num">Записи</th>
              <th>Последно</th>
              <th>Лиценца</th>
              <th>Преземи</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.name}</strong>
                  <div className="mono muted" style={{ fontSize: 11 }}>
                    {s.kind}
                  </div>
                </td>
                <td className="num">{s.trust}</td>
                <td className="num">{countBySource.get(s.id) ?? 0}</td>
                <td className="num muted">
                  {s.lastRunAt ? s.lastRunAt.toISOString().slice(0, 16) : '—'}
                </td>
                <td className="muted" style={{ fontSize: 12, maxWidth: 260 }}>
                  {s.licence ?? '—'}
                </td>
                <td>
                  {hasAdapter(s.kind) ? (
                    <form action={ingestAction} className="row">
                      <input type="hidden" name="sourceId" value={s.id} />
                      <input
                        name="limit"
                        placeholder="лимит"
                        style={{ width: 70 }}
                        inputMode="numeric"
                      />
                      <button type="submit">Преземи</button>
                    </form>
                  ) : (
                    <span className="muted">рачен</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="muted" style={{ marginTop: 12 }}>
        „Преземи“ додава задача во редот. Мора да работи и worker процесот
        (<code>pnpm dev:worker</code>) и Redis. Без Redis, користи{' '}
        <code>pnpm ingest run osm 200</code> од терминал.
      </p>

      {runs.length > 0 ? (
        <>
          <h2>Неуспешни задачи</h2>
          <div className="panel tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Задача</th>
                  <th>Грешка</th>
                  <th>Кога</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.kind}</td>
                    <td className="muted">{r.error}</td>
                    <td className="num muted">{r.startedAt.toISOString().slice(0, 16)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  )
}
