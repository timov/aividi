import Link from 'next/link'
import '../admin.css'
import { count, db, entity, eq, matchCandidate } from '@aividi/db'
import { requireAdmin } from '@/lib/auth'
import { logoutAction } from './actions'

export const metadata = { title: 'aividi.mk admin', robots: { index: false, follow: false } }

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()

  const [pending] = await db
    .select({ n: count() })
    .from(matchCandidate)
    .where(eq(matchCandidate.decision, 'pending'))

  const [drafts] = await db
    .select({ n: count() })
    .from(entity)
    .where(eq(entity.status, 'draft'))

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          aividi<span>.</span>mk
        </div>
        <nav>
          <Link href="/admin">Преглед</Link>
          <Link href="/admin/matches">
            Спојувања{pending && pending.n > 0 ? ` (${pending.n})` : ''}
          </Link>
          <Link href="/admin/entities">
            Субјекти{drafts && drafts.n > 0 ? ` (${drafts.n} нацрт)` : ''}
          </Link>
          <Link href="/admin/articles">Статии</Link>
          <Link href="/admin/sources">Извори</Link>
        </nav>
        <div className="spacer" />
        <form action={logoutAction}>
          <button type="submit" className="ghost" style={{ width: '100%' }}>
            Одјави се
          </button>
        </form>
      </aside>
      <main>{children}</main>
    </div>
  )
}
