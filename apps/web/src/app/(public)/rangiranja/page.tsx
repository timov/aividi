import Link from 'next/link'
import type { Metadata } from 'next'
import { getRankedLists } from '@/lib/public-queries'
import { buildDescription, buildMeta, seoTitle } from '@/lib/seo'

export const revalidate = 900

export async function generateMetadata(): Promise<Metadata> {
  const lists = await getRankedLists()
  return buildMeta({
    title: seoTitle('Ранкинзи — најдобри по категорија'),
    description: buildDescription([
      `${lists.length} рангирани листи низ Македонија, подредени по AIVIDI Score.`,
      'Формулата е јавна и не се купува.',
    ]),
    path: '/rangiranja',
  })
}

export default async function RankingsPage() {
  const lists = await getRankedLists()
  const byTown = new Map<string, typeof lists>()
  for (const l of lists) {
    const group = byTown.get(l.placeName) ?? []
    group.push(l)
    byTown.set(l.placeName, group)
  }

  return (
    <div className="container">
      <nav className="crumbs" aria-label="Патека">
        <Link href="/">Почетна</Link>
        <span>/</span>Ранкинзи
      </nav>

      <h1>Ранкинзи</h1>
      <p className="lede">
        Секоја листа е подредена по AIVIDI Score — комплетност на профилот, свежина на
        проверката и услуги со цени. Формулата е{' '}
        <Link href="/za-biznisi">јавна</Link> и не се купува.
      </p>

      {lists.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 26 }}>
          Сè уште нема рангирани листи што поминале низ index gate.
        </div>
      ) : (
        [...byTown.entries()].map(([town, group]) => (
          <section className="section" key={town} style={{ paddingBottom: 0 }}>
            <h2>{town}</h2>
            <ul className="chips">
              {group.map((l) => (
                <li key={l.slug}>
                  <Link href={l.slug}>
                    {l.title} <span className="chip-n">{l.n}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
