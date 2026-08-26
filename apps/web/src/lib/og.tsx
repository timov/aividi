import {
  SEAL_PATH,
  SEAL_RING_RADIUS,
  SEAL_STROKE,
  SEAL_TICK,
  SEAL_TICK_STROKE,
  SEAL_VIEWBOX,
} from './seal-geometry'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

/**
 * Open Graph images, drawn from the data.
 *
 * In Macedonia a link mostly travels through Viber, Messenger and WhatsApp,
 * and a link without an og:image arrives as a grey stub nobody taps. We have
 * no photography and will not for months — so the image is generated instead:
 * the headline, the count, and the top few businesses with their scores.
 *
 * That turns out to be better than a photo would be. It is specific to the
 * page, it is current the moment the data changes, and it shows the one thing
 * a stock picture of a pizza cannot: that we actually know something.
 */

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'

const FONT_DIR = join(process.cwd(), 'src', 'assets')

let cached: Array<{ name: string; data: Buffer; weight: 400 | 700; style: 'normal' }> | null = null

/** Satori needs real font data, and it needs a face that carries Cyrillic. */
async function fonts() {
  if (cached) return cached
  const [regular, bold] = await Promise.all([
    readFile(join(FONT_DIR, 'Text-Regular.ttf')),
    readFile(join(FONT_DIR, 'Display-Bold.ttf')),
  ])
  cached = [
    { name: 'Aividi', data: regular, weight: 400 as const, style: 'normal' as const },
    { name: 'Aividi', data: bold, weight: 700 as const, style: 'normal' as const },
  ]
  return cached
}

const INK = '#1f1d1b'
const MUTED = '#57534e'
const CREAM = '#fdfbf8'
const ACCENT = '#b83c19'
const LINE = '#eae6e0'

export interface OgRow {
  name: string
  score: number | null
  meta?: string
}

export interface OgInput {
  eyebrow: string
  title: string
  /** One short line under the title — counts, price range. */
  standfirst?: string
  rows?: OgRow[]
  /** Shown bottom-right, e.g. "Ажурирано 26.08.2026". */
  footnote?: string
}

/**
 * The seal, as a data-URI SVG so satori can rasterise it.
 *
 * The number is drawn as a separate text node on top rather than inside the
 * SVG: satori cannot resolve a font inside a data URI, so <text> in there
 * comes out blank.
 */
function sealSvg(fill: string, tick = false): string {
  const inner = tick
    ? `<path d="${SEAL_TICK}" fill="none" stroke="#fff" stroke-width="${SEAL_TICK_STROKE}" stroke-linecap="round" stroke-linejoin="round"/>`
    : ''
  // OG seals are always rendered large, so the struck ring is always on.
  const ring = `<circle cx="22" cy="22" r="${SEAL_RING_RADIUS}" fill="none" stroke="#fff" stroke-opacity="0.42" stroke-width="1.1"/>`
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SEAL_VIEWBOX}"><polygon points="${SEAL_PATH}" fill="${fill}" stroke="${fill}" stroke-width="${SEAL_STROKE}" stroke-linejoin="round"/>${ring}${inner}</svg>`
  return `data:image/svg+xml;base64,${Buffer.from(markup).toString('base64')}`
}

function Meter({ score }: { score: number | null }) {
  const px = 48
  return (
    <div style={{ display: 'flex', width: px, height: px, position: 'relative' }}>
      <img src={sealSvg(ACCENT)} width={px} height={px} />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: px,
          height: px,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          fontWeight: 700,
          color: '#fff',
        }}
      >
        {score === null ? '—' : Math.round(score)}
      </div>
    </div>
  )
}

export async function renderOgImage(input: OgInput) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: CREAM,
          fontFamily: 'Aividi',
          padding: '56px 64px',
          position: 'relative',
        }}
      >
        {/* The same flat shapes the hero uses, bled off the corners. */}
        <div
          style={{
            position: 'absolute',
            top: -150,
            right: -80,
            width: 420,
            height: 300,
            borderRadius: '0 0 420px 420px',
            background: ACCENT,
            opacity: 0.13,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -170,
            left: -90,
            width: 340,
            height: 340,
            borderRadius: '0 44px 0 0',
            background: '#e8b44a',
            opacity: 0.16,
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src={sealSvg(ACCENT, true)} width={34} height={34} />
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, letterSpacing: -1.4 }}>
            <span style={{ color: INK }}>aividi</span>
            <span style={{ color: ACCENT }}>.</span>
            <span style={{ color: INK }}>mk</span>
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: 3,
              color: MUTED,
              textTransform: 'uppercase',
            }}
          >
            {input.eyebrow}
          </div>
        </div>

        {/* flexShrink:0 and an explicit line box: satori under-measures wrapped
            headlines, so without them the standfirst rides up over line two. */}
        <div
          style={{
            display: 'flex',
            flexShrink: 0,
            fontSize: input.title.length > 42 ? 56 : 70,
            fontWeight: 700,
            letterSpacing: -3,
            lineHeight: 1.1,
            color: INK,
            marginTop: 24,
            maxWidth: 1000,
          }}
        >
          {input.title}
        </div>

        {input.standfirst ? (
          <div
            style={{ display: 'flex', flexShrink: 0, fontSize: 26, color: MUTED, marginTop: 18 }}
          >
            {input.standfirst}
          </div>
        ) : null}

        {input.rows && input.rows.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', paddingTop: 24, gap: 0 }}>
            {input.rows.slice(0, 3).map((row, i) => (
              <div
                key={row.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  padding: '16px 0',
                  borderTop: i === 0 ? `1px solid ${LINE}` : 'none',
                  borderBottom: `1px solid ${LINE}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    fontSize: 30,
                    fontWeight: 700,
                    color: '#a49c94',
                    width: 46,
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div
                  style={{
                    display: 'flex',
                    fontSize: 32,
                    fontWeight: 700,
                    color: INK,
                    flex: 1,
                    letterSpacing: -0.8,
                  }}
                >
                  {row.name}
                </div>
                <Meter score={row.score} />
              </div>
            ))}
          </div>
        ) : null}

        {input.footnote ? (
          <div
            style={{
              display: 'flex',
              fontSize: 20,
              color: '#8b837b',
              marginTop: input.rows?.length ? 18 : 'auto',
            }}
          >
            {input.footnote}
          </div>
        ) : null}
      </div>
    ),
    { ...OG_SIZE, fonts: await fonts() },
  )
}
