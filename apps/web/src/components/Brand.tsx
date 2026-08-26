import Link from 'next/link'
import { Seal } from './Seal'

/**
 * The wordmark: the seal plus the name.
 *
 * The seal is the same object that carries a score beside a business and a
 * tick on a verified profile, which is the point — every time someone sees a
 * rating on this site they are also seeing the logo.
 */
export function Logo({
  size = 'md',
  href = '/',
}: {
  size?: 'sm' | 'md' | 'lg'
  href?: string | null
}) {
  // md is 34 rather than 36: the compass points read a touch larger than the
  // old uniform rosette at the same box size.
  const dims = { sm: 25, md: 34, lg: 50 }[size]

  const inner = (
    <>
      <Seal variant="brand" size={dims} className="logo-mark" />
      <span className="logo-word">
        aividi<b>.</b>
        <span className="logo-tld">mk</span>
      </span>
    </>
  )

  if (!href) return <span className={`logo logo-${size}`}>{inner}</span>
  return (
    <Link href={href} className={`logo logo-${size}`} aria-label="aividi.mk — почетна">
      {inner}
    </Link>
  )
}

/**
 * The verification badge.
 *
 * The one claim on this site that has to be earned rather than asserted, so it
 * renders only when a person actually confirmed the record and the large form
 * always carries the date. A badge without a date is marketing; a badge with
 * one is a check somebody can hold us to.
 */
export function VerifiedBadge({
  verifiedAt,
  size = 'sm',
}: {
  verifiedAt: Date | null
  size?: 'sm' | 'lg'
}) {
  if (!verifiedAt) return null

  const date = verifiedAt.toLocaleDateString('mk-MK', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  return (
    <span className={`verified verified-${size}`} title={`Проверено на ${date}`}>
      <Seal variant="verified" size={size === 'lg' ? 22 : 17} />
      <span className="verified-text">
        Проверено
        {size === 'lg' ? <span className="verified-date"> · {date}</span> : null}
      </span>
    </span>
  )
}

/** The seal carrying a number — used where the score is the subject. */
export function ScoreSeal({ score, size = 44 }: { score: number | null; size?: number }) {
  return <Seal variant="score" score={score === null ? null : Math.round(score)} size={size} />
}
