import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  article,
  articleEntry,
  articleFaq,
  category,
  db,
  entity,
  eq,
  place,
} from '@aividi/db'
import {
  addFaqAction,
  deleteFaqAction,
  saveArticleAction,
  saveArticleEntryAction,
  setArticleStatusAction,
} from '../../actions'

export const dynamic = 'force-dynamic'

/**
 * The editorial surface for one article.
 *
 * Only prose is editable. The businesses, their order, prices and hours come
 * from the ranking and are shown read-only, because an article that let you
 * retype them would be carrying a second copy of facts that already exist —
 * and the copy is the one that goes stale.
 */
export default async function ArticleAdminPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [row] = await db
    .select({
      a: article,
      placeName: place.nameMk,
      placeSlug: place.slug,
      categoryName: category.nameMk,
    })
    .from(article)
    .innerJoin(place, eq(place.id, article.placeId))
    .innerJoin(category, eq(category.id, article.categoryId))
    .where(eq(article.id, id))
    .limit(1)

  if (!row) notFound()
  const a = row.a

  const entries = await db
    .select({
      e: articleEntry,
      name: entity.nameMk,
      score: entity.score,
      karma: entity.karma,
      summary: entity.summaryMk,
    })
    .from(articleEntry)
    .innerJoin(entity, eq(entity.id, articleEntry.entityId))
    .where(eq(articleEntry.articleId, id))
    .orderBy(articleEntry.rank)

  const faq = await db
    .select()
    .from(articleFaq)
    .where(eq(articleFaq.articleId, id))
    .orderBy(articleFaq.sort)

  const missing = entries.filter((x) => !x.e.role || !x.e.verdict).length

  return (
    <>
      <nav className="crumbs">
        <Link href="/admin">Админ</Link>
        <span>/</span>
        <Link href="/admin/articles">Статии</Link>
        <span>/</span>
        {a.slug}
      </nav>

      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>{a.headline}</h1>
        <div className="row">
          <span className={`pill ${a.status === 'published' ? 'good' : ''}`}>{a.status}</span>
          {a.status === 'published' ? (
            <a className="btn" href={`/vodic/${a.slug}`} target="_blank" rel="noreferrer">
              Види ја страницата
            </a>
          ) : null}
          <form action={setArticleStatusAction}>
            <input type="hidden" name="id" value={a.id} />
            <input
              type="hidden"
              name="status"
              value={a.status === 'published' ? 'draft' : 'published'}
            />
            <button className="btn">
              {a.status === 'published' ? 'Врати во нацрт' : 'Објави'}
            </button>
          </form>
        </div>
      </div>

      <p className="muted">
        {row.categoryName} · {row.placeName} · <code>/vodic/{a.slug}</code>
        {missing > 0 ? (
          <>
            {' '}
            · <b className="warn">{missing} записи без улога или пресуда</b>
          </>
        ) : null}
      </p>

      {/* ---- the article itself ------------------------------------------- */}
      <h2>Текст</h2>
      <form action={saveArticleAction} className="panel panel-pad form-stack">
        <input type="hidden" name="id" value={a.id} />
        <label>
          <b>Наслов (H1)</b>
          <span className="hint">Без година — годината се додава само во &lt;title&gt;.</span>
          <input name="headline" defaultValue={a.headline} />
        </label>
        <label>
          <b>Резиме (meta description)</b>
          <span className="hint">
            Ова е реченицата што AI најчесто ја цитира буквално. Одговори на прашањето веднаш.
          </span>
          <textarea name="summary" rows={2} defaultValue={a.summary} />
        </label>
        <label>
          <b>Вовед</b>
          <textarea name="intro" rows={4} defaultValue={a.intro ?? ''} />
        </label>
        <label>
          <b>Заклучок</b>
          <textarea name="outro" rows={3} defaultValue={a.outro ?? ''} />
        </label>
        <div className="grid-2">
          <label>
            <b>Насловна фотографија</b>
            <span className="hint">
              Име од <code>/public/covers</code>, од <code>/public/uploads</code>, или полн URL.
            </span>
            <input name="coverKey" defaultValue={a.coverKey ?? ''} />
          </label>
          <label>
            <b>Кредит за фотографијата</b>
            <span className="hint">Задолжително за CC материјал.</span>
            <input name="coverCredit" defaultValue={a.coverCredit ?? ''} />
          </label>
        </div>
        {a.coverKey ? (
          <div className="media-preview media-preview-cover" style={{ width: 240 }}>
            <img src={a.coverKey.startsWith('http') ? a.coverKey : `/${a.coverKey.replace(/^\/+/, '')}`} alt="" />
          </div>
        ) : null}
        <div>
          <button className="btn">Зачувај</button>
        </div>
      </form>

      {/* ---- entries -------------------------------------------------------- */}
      <h2>Записи</h2>
      <p className="muted">
        Редоследот и бизнисите доаѓаат од рангирањето и не се менуваат тука. Повторно пушти{' '}
        <code>pnpm ingest article {row.placeSlug} …</code> за да се освежат.
      </p>

      {entries.map((x) => (
        <form
          key={x.e.id}
          action={saveArticleEntryAction}
          className="panel panel-pad form-stack"
          style={{ marginBottom: 14 }}
        >
          <input type="hidden" name="id" value={a.id} />
          <input type="hidden" name="entryId" value={x.e.id} />

          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>
              {x.e.rank}. {x.name}
            </b>
            <span className="muted">
              Score {x.score ?? '—'} · Карма {x.karma ?? '—'}
            </span>
          </div>

          <label>
            <b>Најдобар за</b>
            <span className="hint">
              Едно прашање што овој запис го добива. Мора да е уникатно во статијата.
            </span>
            <input name="role" defaultValue={x.e.role ?? ''} placeholder="најдобра пица" />
          </label>

          <label>
            <b>Пресуда</b>
            <span className="hint">
              {x.summary
                ? 'Ако е празно, се прикажува резимето од профилот.'
                : 'Нема резиме на профилот — ако е празно, нема да се прикаже текст.'}
            </span>
            <textarea name="verdict" rows={3} defaultValue={x.e.verdict ?? ''} />
          </label>

          <div className="grid-2">
            <label>
              <b>Нашиот избор</b>
              <input name="pick" defaultValue={x.e.pick ?? ''} placeholder="лазањи" />
            </label>
            <label>
              <b>Предупредување</b>
              <span className="hint">Линијата што ги прави останатите веродостојни.</span>
              <input
                name="warning"
                defaultValue={x.e.warning ?? ''}
                placeholder="За викенд навечер задолжително резервирај"
              />
            </label>
          </div>

          <label>
            <b>Instagram објава</b>
            <span className="hint">
              Линк до објава на самиот бизнис (/p/… или /reel/…). Се вградува преку Instagram —
              фотографијата останува кај нив.
            </span>
            <input
              name="embedUrl"
              defaultValue={x.e.embedUrl ?? ''}
              placeholder="https://www.instagram.com/p/XXXXXXXXXXX/"
            />
          </label>

          <div>
            <button className="btn">Зачувај запис</button>
          </div>
        </form>
      ))}

      {/* ---- FAQ ------------------------------------------------------------ */}
      <h2>Прашања</h2>
      <p className="muted">
        Се прикажуваат како FAQPage во структурираните податоци. Празна листа не емитува схема.
      </p>

      {faq.map((f) => (
        <div key={f.id} className="panel panel-pad" style={{ marginBottom: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <b>{f.question}</b>
              <p className="muted" style={{ margin: '4px 0 0' }}>
                {f.answer}
              </p>
            </div>
            <form action={deleteFaqAction}>
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="faqId" value={f.id} />
              <button className="btn">Избриши</button>
            </form>
          </div>
        </div>
      ))}

      <form action={addFaqAction} className="panel panel-pad form-stack">
        <input type="hidden" name="id" value={a.id} />
        <label>
          <b>Ново прашање</b>
          <input name="question" placeholder="Колку чини оброк во Скопје?" />
        </label>
        <label>
          <b>Одговор</b>
          <textarea name="answer" rows={3} />
        </label>
        <div>
          <button className="btn">Додај</button>
        </div>
      </form>
    </>
  )
}
