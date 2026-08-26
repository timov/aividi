import { Icon, hasIcon, type IconName } from './Icon'
import { coverCredit, hasCover } from '@/lib/covers'
import type { Photo as PhotoData } from '@/lib/public-queries'

/**
 * Photography, with a fallback that is a design rather than an apology.
 *
 * Two rules, and the second one matters more than it looks:
 *
 *   Category-level imagery may be licensed stock. A photograph of pizza on the
 *   "Пицерии" page is a category illustration and nobody is misled by it.
 *
 *   A business profile may only show photographs OF THAT BUSINESS — ours, or
 *   the owner's. A stock interior on Виа Пица's page is a picture of somewhere
 *   else presented as their premises, which is exactly the kind of thing this
 *   whole project is supposed to be the opposite of.
 *
 * Until real photos arrive the fallback carries the slot: a tinted panel with
 * the category mark and the business initials, derived from the name so the
 * same business always gets the same colour. It reads as intentional at a
 * glance, which a grey box never does.
 */

export function Photo({
  photo,
  name,
  category,
  ratio = '4 / 3',
  className,
  sizes,
}: {
  photo?: PhotoData
  name: string
  category?: string | null
  ratio?: string
  className?: string
  sizes?: string
}) {
  if (photo) {
    return (
      <figure className={`photo ${className ?? ''}`} style={{ aspectRatio: ratio }}>
        {/* A plain img rather than next/image: sources are a mix of our own
            uploads and owner-supplied URLs, and a remote-pattern allowlist is
            a footgun when the list of hosts is whatever a business sends us. */}
        <img
          src={photo.src}
          alt={`${name}${category ? ` — ${category}` : ''}`}
          width={photo.width ?? undefined}
          height={photo.height ?? undefined}
          loading="lazy"
          decoding="async"
          sizes={sizes}
        />
        {photo.credit ? <figcaption>{photo.credit}</figcaption> : null}
      </figure>
    )
  }

  return <PhotoFallback name={name} category={category} ratio={ratio} className={className} />
}

export function PhotoFallback({
  name,
  category,
  ratio = '4 / 3',
  className,
}: {
  name: string
  category?: string | null
  ratio?: string
  className?: string
}) {
  const initials = name
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  // Stable hue from the name, so a business keeps its colour across pages.
  let hash = 0
  for (const ch of name) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) % 360

  return (
    <div
      className={`photo photo-fallback ${className ?? ''}`}
      style={{
        aspectRatio: ratio,
        background: `hsl(${hash} 34% 94%)`,
        color: `hsl(${hash} 42% 32%)`,
      }}
      aria-hidden="true"
    >
      {category && hasIcon(category) ? (
        <span className="photo-mark">
          <Icon name={category as IconName} size={30} />
        </span>
      ) : null}
      <span className="photo-initials">{initials}</span>
    </div>
  )
}

/**
 * The category cover. Drop a licensed image at
 * /public/covers/{category-slug}.jpg and it appears; until then the page uses
 * the patterned fallback and looks finished either way.
 */
export function CategoryCover({
  slug,
  name,
  ratio = '16 / 9',
}: {
  slug: string
  name: string
  ratio?: string
}) {
  if (!hasCover(slug)) return <PhotoFallback name={name} category={slug} ratio={ratio} />

  const credit = coverCredit(slug)
  return (
    <figure className="photo photo-cover" style={{ aspectRatio: ratio }}>
      <img src={`/covers/${slug}.jpg`} alt="" loading="lazy" decoding="async" />
      {/* Rendered because the licence requires it, not as a courtesy. */}
      {credit ? <figcaption className="photo-credit">{credit}</figcaption> : null}
    </figure>
  )
}
