import Link from 'next/link'
import { MODIFIERS } from '@aividi/core'
import { BusinessCard, RankRow } from '@/components/BusinessCard'
import { JsonLd } from '@/components/JsonLd'
import { CategoryCover } from '@/components/Photo'
import type { getListPage } from '@/lib/public-queries'
import { answerText, breadcrumbJsonLd, listJsonLd, SITE_URL } from '@/lib/seo'

type Page = NonNullable<Awaited<ReturnType<typeof getListPage>>>

/**
 * One list, rendered in whichever register it has earned.
 *
 * A category page is a working tool someone opens at 21:00 — browse register.
 * A "најдобри" page is a published ranking — editorial register. Same data,
 * same brand, different job.
 */
export function ListView({ page, basePath }: { page: Page; basePath: string }) {
  const editorial = page.modifier === 'najdobri'
  const answer = answerText(page)
  const total = page.sponsored.length + page.organic.length

  return (
    <div className="container">
      <JsonLd data={listJsonLd(page, `${SITE_URL}${basePath}`)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Почетна', url: '/' },
          { name: page.placeName, url: `/${page.placeSlug}` },
          { name: page.categoryName, url: `/${page.placeSlug}/${page.categorySlug}` },
        ])}
      />

      <nav className="crumbs" aria-label="Патека">
        <Link href="/">Почетна</Link>
        <span>/</span>
        <Link href={`/${page.placeSlug}`}>{page.placeName}</Link>
        {page.modifier ? (
          <>
            <span>/</span>
            <Link href={`/${page.placeSlug}/${page.categorySlug}`}>{page.categoryName}</Link>
          </>
        ) : null}
      </nav>

      {editorial ? (
        <EditorialList page={page} answer={answer} />
      ) : (
        <BrowseList page={page} answer={answer} total={total} />
      )}

      <section className="section" style={{ paddingBottom: 0 }}>
        <Facets page={page} />
      </section>

      <section className="section">
        <h2>Како е подредена листата</h2>
        <p className="lede">
          Редоследот го одредува <strong>AIVIDI Score</strong> — комплетност на профилот, кога
          последно е проверен, услуги со цени, фотографии и оценки. Секој бизнис може да го
          подигне бесплатно, со подобри податоци.
          {page.sponsored.length > 0
            ? ' Спонзорираните места се обележани и стојат над листата — плаќањето не го менува редоследот под нив.'
            : ''}
        </p>
      </section>

      {!page.isIndexable && page.gateReason ? (
        <p className="noindex-note">Оваа страница е noindex: {page.gateReason}.</p>
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------------
   Browse register
   ------------------------------------------------------------------------- */

function BrowseList({ page, answer, total }: { page: Page; answer: string; total: number }) {
  return (
    <>
      <div className="list-cover">
        <CategoryCover slug={page.categorySlug} name={page.categoryName} ratio="16 / 5" />
      </div>
      <h1>{page.title}</h1>

      {answer ? (
        <p className="standfirst">
          {answer}
          <span className="checked">
            Последно ажурирано {page.updatedAt.toLocaleDateString('mk-MK')}
          </span>
        </p>
      ) : null}

      {total === 0 ? (
        <div className="empty-state" style={{ marginTop: 26 }}>
          Сè уште немаме објавени бизниси во оваа категорија.
        </div>
      ) : null}

      {page.sponsored.length > 0 ? (
        <ul className="records" aria-label="Спонзорирани">
          {page.sponsored.map((card) => (
            <BusinessCard key={card.id} card={card} showSponsorTag />
          ))}
        </ul>
      ) : null}

      {page.organic.length > 0 ? (
        <>
          <ul className="records">
            {page.organic.map((card) => (
              <BusinessCard key={card.id} card={card} />
            ))}
          </ul>
        </>
      ) : null}
    </>
  )
}

/* -------------------------------------------------------------------------
   Editorial register
   ------------------------------------------------------------------------- */

function EditorialList({ page, answer }: { page: Page; answer: string }) {
  const year = new Date().getFullYear()

  return (
    <div className="editorial">
      <div className="container">
        <header className="ed-head">
          <span className="ed-eyebrow label">Рангирање · {year}</span>
          <h1 className="ed-title">{page.title}</h1>
          {answer ? (
            <p className="ed-standfirst">
              {answer}
              <span className="checked">
                Последно ажурирано {page.updatedAt.toLocaleDateString('mk-MK')}
              </span>
            </p>
          ) : null}
        </header>

        <ol className="ranked">
          {page.sponsored.map((card) => (
            <RankRow key={card.id} card={card} rank={null} />
          ))}
          {page.organic.map((card, i) => (
            <RankRow key={card.id} card={card} rank={i + 1} />
          ))}
        </ol>

        <p className="ed-note">
          Рангирањето го пресметува AIVIDI Score и се менува како што бизнисите ги дополнуваат
          своите податоци. Спонзорираните места се обележани и стојат надвор од рангирањето.
        </p>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------
   Facets
   ------------------------------------------------------------------------- */

function Facets({ page }: { page: Page }) {
  const facets = Object.values(MODIFIERS).filter((m) => {
    if (page.modifier === m.slug) return false
    if (m.requiresAttribute) {
      return page.organic.some((c) =>
        c.attributes.some((a) => a.toLowerCase().includes(facetHint(m.slug))),
      )
    }
    if (m.requiresPricedServices) return page.organic.some((c) => c.priceFrom !== null)
    return page.organic.length >= 4
  })

  if (facets.length === 0) return null

  return (
    <>
      <h2>Прикажи само</h2>
      <ul className="chips">
        {facets.map((m) => (
          <li key={m.slug}>
            <Link href={`/${page.placeSlug}/${page.categorySlug}/${m.slug}`}>
              {m.title(page.categoryName, page.placeName)}
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

/** Maps a modifier slug to the Macedonian attribute wording on the cards. */
function facetHint(slug: string): string {
  if (slug === 'dostava') return 'достав'
  if (slug === 'parking') return 'паркинг'
  if (slug === 'otvoreno-vikend') return 'викенд'
  return slug
}
