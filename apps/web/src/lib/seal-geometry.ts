/**
 * THE SEAL, as pure geometry.
 *
 * One definition, imported by every renderer: the React component, the OG
 * image builder, the brand sheet and the favicon generator. It used to be
 * copy-pasted into four files, which is how a brand mark quietly ends up with
 * four slightly different silhouettes.
 *
 * WHY THIS SHAPE. A plain uniform rosette is the verified badge — Twitter,
 * Instagram, Trustpilot and a hundred directories all use it, so it says
 * "somebody checked this" and nothing else. Ours keeps that reading but
 * lengthens four points on the cardinal axes, which turns the silhouette into
 * a compass rose. That is the whole business in one mark: a seal says the
 * record is checked, a compass says we will get you there. It also means the
 * shape is recognisably ours at a glance, which a uniform rosette never is.
 *
 * The four long points also do the small-size work. Below about 20px the fine
 * cogs blur into a circle, but the cardinal spikes still read, so the mark
 * keeps an identity in a browser tab where a plain rosette becomes a dot.
 */

const POINTS = 24
/** Ordinary cog tips. */
const OUTER = 18.4
/** The valleys between cogs. */
const INNER = 16.2
/** North, east, south, west — every sixth point, all of which land on OUTER. */
const CARDINAL = 21.4
const CARDINAL_EVERY = 6

/** All coordinates live in a 44x44 box centred on (22, 22). */
export const SEAL_VIEWBOX = '0 0 44 44'
export const SEAL_STROKE = 3.1

function build(): string {
  const pts: string[] = []
  for (let i = 0; i < POINTS; i++) {
    const angle = (i / POINTS) * Math.PI * 2 - Math.PI / 2
    let r = i % 2 === 0 ? OUTER : INNER
    if (i % CARDINAL_EVERY === 0) r = CARDINAL
    pts.push(`${(22 + Math.cos(angle) * r).toFixed(2)},${(22 + Math.sin(angle) * r).toFixed(2)}`)
  }
  return pts.join(' ')
}

export const SEAL_PATH = build()

/** The check. Slightly tighter than a generic tick so it sits inside the ring. */
export const SEAL_TICK = 'm15.4 22.4 4.3 4.3 8.5-8.9'
export const SEAL_TICK_STROKE = 3.2

/**
 * The struck ring inside the rim, the way a coin or a wax seal is made.
 *
 * It is what lifts the mark from "a shape" to "a thing that was minted", but
 * it is a large-size detail only: under about 30px the ring and the rim merge
 * into a muddy band and the mark reads worse than without it. Renderers ask
 * `showRing(size)` rather than deciding for themselves.
 */
export const SEAL_RING_RADIUS = 14.6
export const SEAL_RING_MIN_SIZE = 30

export function showRing(size: number): boolean {
  return size >= SEAL_RING_MIN_SIZE
}
