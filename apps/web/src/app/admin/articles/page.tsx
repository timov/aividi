import Link from 'next/link'
import { article, articleEntry, category, count, db, desc, eq, place } from '@aividi/db'

export const dynamic = 'force-dynamic'

export default async function ArticlesAdminPage() {
  const rows = await db
    .select({
      id: article.id,
      slug: article.slug,
      headline: article.headline,
      status: article.status,
      updatedAt: article.updatedAt,
      placeName: place.nameMk,
      categoryName: category.nameMk,
      entries: count(articleEntry.id),
    })
    .from(article)
    .innerJoin(place, eq(place.id, article.placeId))
    .innerJoin(category, eq(category.id, article.categoryId))
    .leftJoin(articleEntry, eq(articleEntry.articleId, article.id))
    .groupBy(article.id, place.nameMk, category.nameMk)
    .orderBy(desc(article.updatedAt))

  return (
    <>
      <nav className="crumbs">
        <Link href="/admin">Админ</Link>
        <span>/</span>Статии
      </nav>

      <h1>Статии</h1>
      <p className="muted">
        Нова статија се прави од терминал:{' '}
        <code>pnpm ingest article &lt;град&gt; &lt;категорија&gt; --author &quot;Име&quot;</code> —
        рангирањето мора да е изградено прво.
      </p>

      {rows.length === 0 ? (
        <div className="panel panel-pad muted">Сè уште нема ниту една статија.</div>
      ) : (
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Наслов</th>
                <th>Опфат</th>
                <th>Записи</th>
                <th>Статус</th>
                <th>Ажурирано</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/admin/articles/${r.id}`}>{r.headline}</Link>
                    <br />
                    <code className="muted">/vodic/{r.slug}</code>
                  </td>
                  <td>
                    {r.categoryName} · {r.placeName}
                  </td>
                  <td>{Number(r.entries)}</td>
                  <td>
                    <span className={`pill ${r.status === 'published' ? 'good' : ''}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="muted">{r.updatedAt.toLocaleDateString('mk-MK')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
