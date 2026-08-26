import type { Metadata } from 'next'
import { BusinessCard } from '@/components/BusinessCard'
import { search } from '@/lib/public-queries'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Пребарување',
  // Search result pages are noindex everywhere, and should be here too:
  // they are generated per query and add nothing a category page does not.
  robots: { index: false, follow: true },
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q = '' } = await searchParams
  const results = q.trim().length >= 2 ? await search(q) : []

  return (
    <div className="container">
      <h1 style={{ marginTop: 30 }}>Пребарување</h1>

      <form className="search" action="/prebaraj" role="search" style={{ margin: '18px 0 26px' }}>
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Пица, стоматолог, автосервис…"
          aria-label="Пребарај бизнис"
        />
        <button type="submit">Пребарај</button>
      </form>

      {q.trim().length < 2 ? (
        <p className="lede">Внеси барем две букви.</p>
      ) : results.length === 0 ? (
        <div className="empty-state">
          <p style={{ marginBottom: 6 }}>
            <strong>Нема резултати за „{q}“.</strong>
          </p>
          <p className="small" style={{ margin: 0 }}>
            Обиди се со пократок збор, или разгледај ги категориите на почетната страница.
          </p>
        </div>
      ) : (
        <>
          <p className="lede">
            {results.length} {results.length === 1 ? 'резултат' : 'резултати'} за „{q}“.
          </p>
          <ul className="records">
            {results.map((card) => (
              <BusinessCard key={card.id} card={card} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
