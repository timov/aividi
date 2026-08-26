import {
  SEAL_PATH,
  SEAL_RING_RADIUS,
  SEAL_STROKE,
  SEAL_TICK,
  SEAL_TICK_STROKE,
  SEAL_VIEWBOX,
  showRing,
} from '@/lib/seal-geometry'

/**
 * THE SEAL — one shape, every job.
 *
 * Trustpilot's power is that the star is simultaneously the logo, the rating
 * device and the thing a business embeds on its own site. One object carries
 * the whole brand. We had three marks competing: a monogram in the logo, a
 * segmented meter in the lists, and a separate tick badge. This replaces all
 * of it with a single rosette used in three readings:
 *
 *   brand     a checked seal in paprika — the mark beside the wordmark
 *   verified  the same checked seal in green — "a person checked this record"
 *   score     the seal carrying a number — "this profile scores 84 of 100"
 *   karma     the same silhouette, but hollow — "people rate this 85"
 *
 * Brand and verified share the tick on purpose. Checking things is what the
 * company does, so the mark should say so, and Trustpilot proves context
 * separates a logo star from a rating star without anyone being confused.
 * Colour does the rest: paprika is the brand, green is a claim about a
 * specific business on a specific date.
 *
 * Karma is drawn as a ring rather than a solid, and that is the whole idea:
 * a filled seal is something WE award, a hollow one is something we merely
 * report. We do not control what people think of a business and the mark
 * should not pretend otherwise. Its own colour keeps it clear of both the
 * paprika brand and the green verification.
 *
 * Score stays a separate reading and must never collapse into the tick: a
 * profile can be complete but unchecked, or checked and thin. Those are
 * different promises and a single badge for both would be a lie.
 *
 * The rosette is drawn rather than lettered so it survives at 16px in a
 * browser tab and at 200px on a sticker in a shop window. Its geometry — and
 * the reason four of its points are longer than the rest — lives in
 * lib/seal-geometry.ts, which every renderer imports so the mark cannot drift.
 */

export type SealVariant = 'brand' | 'score' | 'verified' | 'karma'

export function Seal({
  variant = 'brand',
  score,
  size = 34,
  className,
}: {
  variant?: SealVariant
  score?: number | null
  size?: number
  className?: string
}) {
  const label =
    variant === 'verified'
      ? 'Проверено од aividi.mk'
      : variant === 'score'
        ? `AIVIDI Score ${score ?? '—'} од 100`
        : variant === 'karma'
          ? `Карма ${score ?? '—'} од 100`
          : 'aividi.mk'

  return (
    <svg
      className={`seal seal-${variant} ${className ?? ''}`}
      width={size}
      height={size}
      viewBox={SEAL_VIEWBOX}
      role="img"
      aria-label={label}
    >
      <polygon
        points={SEAL_PATH}
        className="seal-body"
        strokeWidth={SEAL_STROKE}
        strokeLinejoin="round"
      />
      {/* The struck ring. Large sizes only — see seal-geometry.ts. */}
      {showRing(size) ? (
        <circle
          cx="22"
          cy="22"
          r={SEAL_RING_RADIUS}
          fill="none"
          className="seal-ring"
          strokeWidth="1.1"
        />
      ) : null}
      {variant === 'verified' || variant === 'brand' ? (
        <path
          d={SEAL_TICK}
          fill="none"
          className="seal-tick"
          strokeWidth={SEAL_TICK_STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {variant === 'score' || variant === 'karma' ? (
        <text
          x="22"
          y="22.8"
          textAnchor="middle"
          dominantBaseline="middle"
          className="seal-num"
          fontSize={score !== null && score !== undefined && score >= 100 ? 13 : 15.5}
        >
          {score ?? '—'}
        </text>
      ) : null}
    </svg>
  )
}
