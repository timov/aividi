/**
 * Monoline icons, drawn inline.
 *
 * One stroke weight, one grid, one visual language — the thing that makes an
 * icon row read as designed rather than as emoji dropped into a template.
 * Every icon is decorative: it always sits next to a text label and is hidden
 * from assistive tech, because an icon alone is not a control.
 */

const base = {
  width: 26,
  height: 26,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export type IconName =
  | 'restorani'
  | 'kafulinja'
  | 'brza-hrana'
  | 'picerii'
  | 'stomatolozi'
  | 'avtoservisi'
  | 'majstori'
  | 'saloni-za-ubavina'
  | 'nedvizhnini'
  | 'smestuvanje'
  | 'svadbi-i-nastani'
  | 'advokati-i-smetkovodstvo'
  | 'prodavnici'
  | 'phone'
  | 'pin'
  | 'globe'
  | 'clock'
  | 'search'
  | 'check'
  | 'building'
  | 'grid'
  | 'tag'
  | 'sparkle'
  | 'menu'
  | 'close'

const PATHS: Record<IconName, React.ReactNode> = {
  restorani: (
    <>
      <path d="M6 3v8a2 2 0 0 0 4 0V3M8 11v10" />
      <path d="M17 3c-1.5 1.5-2 3.5-2 6s.7 3 2 3v9" />
    </>
  ),
  kafulinja: (
    <>
      <path d="M4 8h12v5a5 5 0 0 1-10 0z" />
      <path d="M16 9h2a2.5 2.5 0 0 1 0 5h-2" />
      <path d="M4 21h14" />
    </>
  ),
  'brza-hrana': (
    <>
      <path d="M3 11a9 9 0 0 1 18 0z" />
      <path d="M3 15h18" />
      <path d="M5 19h14" />
    </>
  ),
  picerii: (
    <>
      <path d="M12 3 3 20c6 2.5 12 2.5 18 0z" />
      <circle cx="10" cy="12" r="1" />
      <circle cx="14" cy="16" r="1" />
    </>
  ),
  stomatolozi: (
    <>
      <path d="M12 4c3-1.5 6 0 6 4 0 5-1.5 12-3 12s-1.5-5-3-5-1.5 5-3 5-3-7-3-12c0-4 3-5.5 6-4z" />
    </>
  ),
  avtoservisi: (
    <>
      <path d="M3 13h18l-2-5H5z" />
      <path d="M3 13v5h18v-5" />
      <circle cx="7" cy="18" r="1.5" />
      <circle cx="17" cy="18" r="1.5" />
    </>
  ),
  majstori: (
    <>
      <path d="M14 4a4 4 0 0 0 5 5l-9 9a2.8 2.8 0 0 1-4-4z" />
      <path d="M5 19h.01" />
    </>
  ),
  'saloni-za-ubavina': (
    <>
      <circle cx="6" cy="7" r="2.5" />
      <circle cx="6" cy="17" r="2.5" />
      <path d="M8 8.5 20 17M8 15.5 20 7" />
    </>
  ),
  nedvizhnini: (
    <>
      <path d="M3 11 12 4l9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  smestuvanje: (
    <>
      <path d="M3 18V7M3 12h18v6" />
      <path d="M7 12V9h8a3 3 0 0 1 3 3" />
      <circle cx="7.5" cy="9.5" r="0" />
    </>
  ),
  'svadbi-i-nastani': (
    <>
      <path d="M12 21s-7-4.5-7-9a4 4 0 0 1 7-2.5A4 4 0 0 1 19 12c0 4.5-7 9-7 9z" />
    </>
  ),
  'advokati-i-smetkovodstvo': (
    <>
      <path d="M12 3v18M6 21h12" />
      <path d="M4 8h16" />
      <path d="M7 8 4 14h6zM17 8l-3 6h6z" />
    </>
  ),
  prodavnici: (
    <>
      <path d="M4 8h16l-1 12H5z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />,
  pin: (
    <>
      <path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  check: <path d="m5 13 4 4 10-10" />,
  building: (
    <>
      <path d="M4 21V6l7-3v18M11 21V9l8 3v9M3 21h18" />
      <path d="M7 9h.01M7 13h.01M15 14h.01M15 17h.01" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3.2 13.6 8l4.8 1.6-4.8 1.6L12 16l-1.6-4.8L5.6 9.6 10.4 8z" />
      <path d="M18.4 15.2 19.2 17.6l2.4.8-2.4.8-.8 2.4-.8-2.4-2.4-.8 2.4-.8z" />
    </>
  ),
  tag: (
    <>
      <path d="M3 12.5V4h8.5L21 13.5 13.5 21z" />
      <circle cx="7.5" cy="8" r="1.3" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
}

export function Icon({ name, size = 26 }: { name: IconName; size?: number }) {
  return (
    <svg {...base} width={size} height={size}>
      {PATHS[name]}
    </svg>
  )
}

export function hasIcon(name: string): name is IconName {
  return name in PATHS
}
