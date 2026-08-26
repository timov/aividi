import { Icon } from './Icon'
import type { CardData } from '@/lib/public-queries'

/**
 * Map link for one business.
 *
 * Two levels of precision, and the difference is deliberate. With real
 * coordinates the link drops a pin exactly where the business is. Without
 * them, the link runs a SEARCH for the name and address instead — which is
 * honest, because we are handing over the text we actually hold and letting
 * Google resolve it, rather than inventing a pin. Fabricated coordinates are
 * how this site got "strange google maps locations" the first time around and
 * that must not come back.
 */
export function mapUrl(card: {
  name: string
  address: string | null
  placeName: string | null
  lat: number | null
  lng: number | null
}): string | null {
  if (card.lat !== null && card.lng !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${card.lat},${card.lng}`
  }

  const query = [card.name, card.address, card.placeName].filter(Boolean).join(', ')
  if (!card.address) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

/** True when we can point at the exact spot rather than a search for it. */
export function hasPin(card: { lat: number | null; lng: number | null }): boolean {
  return card.lat !== null && card.lng !== null
}

export function MapButton({ card }: { card: CardData }) {
  const href = mapUrl(card)
  if (!href) return null

  const pinned = hasPin(card)
  return (
    <a
      className="chip chip-map"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={pinned ? 'Отвори точна локација во Google Maps' : 'Побарај ја адресата во Google Maps'}
    >
      <Icon name="pin" size={15} />
      <span>{card.address ?? 'Прикажи на карта'}</span>
      {!pinned ? <span className="chip-note">барај</span> : null}
    </a>
  )
}

/**
 * The business's own places on the internet.
 *
 * Only what exists is rendered — an empty row of greyed-out social icons
 * advertises what a profile is missing, which is the opposite of the job.
 */
export function SocialLinks({ card }: { card: CardData }) {
  const links: Array<{ href: string; label: string; icon: 'globe' | 'tag' }> = []

  if (card.website) {
    links.push({
      href: card.website.startsWith('http') ? card.website : `https://${card.website}`,
      label: card.website.replace(/^https?:\/\//, '').replace(/\/$/, ''),
      icon: 'globe',
    })
  }
  if (card.instagram) links.push({ href: instagramUrl(card.instagram), label: 'Instagram', icon: 'tag' })
  if (card.facebook) links.push({ href: facebookUrl(card.facebook), label: 'Facebook', icon: 'tag' })

  if (links.length === 0) return null

  return (
    <>
      {links.map((l) => (
        <a
          key={l.href}
          className="chip"
          href={l.href}
          target="_blank"
          rel="noopener noreferrer nofollow"
        >
          <Icon name={l.icon} size={15} />
          <span>{l.label}</span>
        </a>
      ))}
    </>
  )
}

/** Handles are stored bare in the CSV, but a full URL is also accepted. */
function instagramUrl(v: string): string {
  if (v.startsWith('http')) return v
  return `https://www.instagram.com/${v.replace(/^@/, '')}/`
}

function facebookUrl(v: string): string {
  if (v.startsWith('http')) return v
  return `https://www.facebook.com/${v}/`
}
