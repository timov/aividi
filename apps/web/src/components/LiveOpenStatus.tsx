'use client'

import { useEffect, useState } from 'react'
import { openStatus, type HourRow, type OpenStatus } from '@aividi/core'

/**
 * Open/closed is the one field on a cached page that cannot be allowed to
 * freeze: a business closing at 23:00 has to stop reading "closing soon"
 * the moment the clock passes 23:00, not up to 15 minutes later on the
 * next ISR revalidation (longer still if nobody happens to load the page
 * in between - stale-while-revalidate only refreshes on the next request).
 *
 * openStatus() itself was always correct, including the "closed, opens
 * tomorrow at 07:00" case - the bug was entirely that every call site
 * computed it once, at render time, inside a server component whose HTML
 * then sat in cache. This recomputes on mount against the browser's own
 * clock (fixing a stale server render the instant the page hydrates) and
 * once a minute after, so a tab left open all evening stays correct too.
 *
 * `variant` rather than a render-prop: every call site has its own layout
 * for the label/detail, but a Server Component cannot pass a function as
 * a Client Component's children - only serializable props cross that
 * boundary, and `hours` plus a variant string both do.
 *
 * `initialStatus` is the server's own openStatus(hours) call, passed in
 * rather than recomputed here. The client's first render has to match the
 * server's markup exactly or React discards and rebuilds the whole
 * subtree with a hydration-mismatch warning - which is exactly what
 * calling openStatus() fresh (i.e. against Date.now()) inside useState's
 * initializer caused, since that runs on the client's first pass too, and
 * the whole point of this component is that the answer can differ between
 * the two. Seeding state with the server's own value keeps that first
 * pass identical; useEffect only ever fires after hydration, so its
 * correction is a plain client-side update, not a hydration one.
 */
function useLiveStatus(hours: HourRow[], initialStatus: OpenStatus): OpenStatus {
  const [status, setStatus] = useState<OpenStatus>(initialStatus)

  useEffect(() => {
    setStatus(openStatus(hours))
    const id = setInterval(() => setStatus(openStatus(hours)), 60_000)
    return () => clearInterval(id)
  }, [hours])

  return status
}

export function LiveOpenStatus({
  hours,
  initialStatus,
  variant,
}: {
  hours: HourRow[]
  initialStatus: OpenStatus
  /** badge: the styled state pill. inline: lowercase, in a "·"-joined meta
   *  line. cell: plain label for a table cell. detail: an <li> with a clock
   *  icon. All render nothing for an 'unknown' state except "cell". */
  variant: 'badge' | 'inline' | 'cell' | 'detail'
}) {
  const status = useLiveStatus(hours, initialStatus)

  if (variant === 'cell') {
    return <>{status.state === 'unknown' ? '—' : status.label}</>
  }

  if (status.state === 'unknown') return null

  if (variant === 'badge') {
    return (
      <span className={`state ${status.state === 'closing_soon' ? 'open' : status.state}`}>
        {status.label}
        {status.detail ? <span className="when">· {status.detail}</span> : null}
      </span>
    )
  }

  if (variant === 'inline') {
    return (
      <>
        <span className="sep">·</span>
        {status.label.toLowerCase()}
        {status.detail ? ` (${status.detail})` : ''}
      </>
    )
  }

  return (
    <li>
      <span aria-hidden="true">⏰</span>
      {status.label}
      {status.detail ? ` · ${status.detail}` : ''}
    </li>
  )
}
