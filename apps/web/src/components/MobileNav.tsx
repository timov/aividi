'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Icon } from './Icon'

const LINKS: Array<{ href: string; label: string }> = [
  { href: '/gradovi', label: 'Градови' },
  { href: '/kategorii', label: 'Категории' },
  { href: '/rangiranja', label: 'Ранкинзи' },
  { href: '/vodic', label: 'Водич' },
]

/**
 * The header nav. A plain flex row on wide screens; below the breakpoint it
 * collapses behind a toggle button instead of the old horizontally-scrolling
 * strip, which technically didn't blow out the page width but still made
 * "За бизниси" — the one link worth a tap — something you had to swipe to find.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // A route change means a link was followed - close the panel behind it.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name={open ? 'close' : 'menu'} size={24} />
        <span className="sr-only">{open ? 'Затвори мени' : 'Отвори мени'}</span>
      </button>
      <ul id="site-nav" className={`nav-links${open ? ' is-open' : ''}`}>
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href}>{l.label}</Link>
          </li>
        ))}
        <li>
          <Link href="/za-biznisi" className="nav-cta">
            За бизниси
          </Link>
        </li>
      </ul>
    </>
  )
}
