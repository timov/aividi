import Link from 'next/link'
import type { Metadata } from 'next'
import { Icon } from '@/components/Icon'
import { Photo } from '@/components/Photo'
import { getArticles, getRankedLists } from '@/lib/public-queries'
import { buildMeta } from '@/lib/seo'

export const revalidate = 3600

export const metadata: Metadata = buildMeta({
  title: 'Водич — како ја градиме базата',
  description:
    'Од каде доаѓаат податоците на aividi.mk, како ги проверуваме, што значи AIVIDI Score и како да пријавиш исправка или бришење на профил.',
  path: '/vodic',
})

/**
 * The editorial section, opened with the one article we can write honestly
 * today: how the data is made. Everything else here is a link into the
 * database rather than a post, so there is no half-built blog sitting empty
 * on the navigation.
 */
export default async function GuidePage() {
  const [lists, articles] = await Promise.all([getRankedLists(), getArticles()])

  return (
    <div className="container" style={{ maxWidth: 860 }}>
      <nav className="crumbs" aria-label="Патека">
        <Link href="/">Почетна</Link>
        <span>/</span>Водич
      </nav>

      <h1>Водич</h1>
      <p className="lede">
        Избори по градови и категории, и објаснување како ја градиме базата зад нив.
      </p>

      {articles.length > 0 ? (
        <section className="section">
          <h2>Избори по градови</h2>
          <ul className="cards">
            {articles.map((a) => (
              <li key={a.slug} className="card card-cover">
                <Link href={`/vodic/${a.slug}`}>
                  <Photo
                    photo={
                      a.coverKey
                        ? {
                            src: a.coverKey.startsWith('http') ? a.coverKey : `/${a.coverKey}`,
                            credit: null,
                            width: null,
                            height: null,
                          }
                        : undefined
                    }
                    name={a.headline}
                    category={a.categorySlug}
                    ratio="16 / 9"
                  />
                </Link>
                <h3>
                  <Link href={`/vodic/${a.slug}`}>{a.headline}</Link>
                </h3>
                <p className="card-sub">{a.summary}</p>
                <p className="card-sub">
                  {a.count} бизниси
                  <span className="sep">·</span>
                  ажурирано{' '}
                  {a.updatedAt.toLocaleDateString('mk-MK', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <h2 style={{ marginTop: 44 }}>Како ја градиме базата</h2>
      <p className="lede">
        Секој податок на aividi.mk си го носи изворот со себе. Еве што тоа значи во
        пракса — и што можеш да очекуваш кога ќе отвориш профил.
      </p>

      <section className="section">
        <h2>Од каде доаѓаат податоците</h2>
        <div className="factcards">
          <div className="factcard">
            <span className="ic">
              <Icon name="globe" size={20} />
            </span>
            <div>
              <b>Отворени извори</b>
              <span>
                OpenStreetMap ни кажува дека бизнисот постои и каде е. Тоа е широчина, не
                длабочина — телефон има само мал дел од записите.
              </span>
            </div>
          </div>
          <div className="factcard">
            <span className="ic">
              <Icon name="phone" size={20} />
            </span>
            <div>
              <b>Проверка по телефон</b>
              <span>
                Работното време, услугите и цените ги потврдуваме директно со бизнисот.
                Проверката носи датум и старее — затоа профилите се одржуваат.
              </span>
            </div>
          </div>
          <div className="factcard">
            <span className="ic">
              <Icon name="check" size={20} />
            </span>
            <div>
              <b>Од самите бизниси</b>
              <span>
                Сопственикот може да го преземе профилот и да ги дополни податоците.
                Неговите податоци имаат предност пред секој автоматски извор.
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Што значи AIVIDI Score</h2>
        <p>
          Оценка од 0 до 100 што покажува колку е комплетен и колку е свеж профилот — не
          колку е добар бизнисот. Формулата е јавна и{' '}
          <Link href="/za-biznisi">целосно објаснета</Link>. Не се купува: спонзорираните
          места се обележани и стојат надвор од рангирањето.
        </p>
      </section>

      {lists.length > 0 ? (
        <section className="section">
          <h2>Рангирани листи</h2>
          <ul className="chips">
            {lists.slice(0, 12).map((l) => (
              <li key={l.slug}>
                <Link href={l.slug}>{l.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="section">
        <h2>Нешто е погрешно?</h2>
        <p style={{ marginBottom: 0 }}>
          Податоците стареат и грешиме. <Link href="/prijavi">Пријави исправка</Link> и
          поправаме — или целосно го бришеме профилот, во рок од 5 работни дена.
        </p>
      </section>
    </div>
  )
}
