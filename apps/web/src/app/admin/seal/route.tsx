import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'

import {
  SEAL_PATH,
  SEAL_RING_RADIUS,
  SEAL_STROKE,
  SEAL_TICK,
  SEAL_TICK_STROKE,
} from '@/lib/seal-geometry'

interface SealOpts {
  fill: string
  stroke?: string
  /** Omitted for the tick variants. */
  num?: string
  numFill?: string
}

function svg(variant: 'brand' | 'score' | 'verified' | 'karma', opts: SealOpts) {
  const tick = `<path d="${SEAL_TICK}" fill="none" stroke="#fff" stroke-width="${SEAL_TICK_STROKE}" stroke-linecap="round" stroke-linejoin="round"/>`
  const inner =
    variant === 'score' || variant === 'karma'
      ? `<text x="22" y="23.4" text-anchor="middle" dominant-baseline="middle" fill="${opts.numFill ?? '#fff'}" font-family="sans-serif" font-size="15.5" font-weight="800">${opts.num ?? '84'}</text>`
      : tick
  return `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44"><polygon points="${SEAL_PATH}" fill="${opts.fill}" stroke="${opts.stroke ?? opts.fill}" stroke-width="${SEAL_STROKE}" stroke-linejoin="round"/><circle cx="22" cy="22" r="${SEAL_RING_RADIUS}" fill="none" stroke="${opts.numFill ?? '#fff'}" stroke-opacity="0.42" stroke-width="1.1"/>${inner}</svg>`,
  ).toString('base64')}`
}

const BRAND = { fill: '#b83c19' }
const SCORE = { fill: '#b83c19', num: '84' }
const KARMA = { fill: '#ecebf7', stroke: '#3f3d9e', num: '91', numFill: '#3f3d9e' }
const VERIFIED = { fill: '#0e7a4f' }

export async function GET() {
  const font = await readFile(join(process.cwd(), 'src', 'assets', 'Display-Bold.ttf'))
  const row = (label: string, src: string, px: number) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <img src={src} width={px} height={px} />
      <div style={{ display: 'flex', fontSize: 18, color: '#57534e' }}>{label}</div>
    </div>
  )
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: '#fdfbf8',
          fontFamily: 'D',
          padding: 50,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 44 }}>
          <img src={svg('brand', BRAND)} width={54} height={54} />
          <div style={{ display: 'flex', fontSize: 46, fontWeight: 800, letterSpacing: -2.4 }}>
            <span style={{ color: '#1f1d1b' }}>aividi</span>
            <span style={{ color: '#b83c19' }}>.</span>
            <span style={{ color: '#1f1d1b' }}>mk</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 54, alignItems: 'flex-end' }}>
          {row('brand · 120px', svg('brand', BRAND), 120)}
          {row('score · 120px', svg('score', SCORE), 120)}
          {row('karma · 120px', svg('karma', KARMA), 120)}
          {row('verified · 120px', svg('verified', VERIFIED), 120)}
          {row('26px', svg('brand', BRAND), 26)}
          {row('16px', svg('verified', VERIFIED), 16)}
        </div>
      </div>
    ),
    { width: 1100, height: 480, fonts: [{ name: 'D', data: font, weight: 800, style: 'normal' }] },
  )
}
