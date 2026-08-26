/**
 * Randomised order that is safe to render on the server.
 *
 * Both the hero headline and the search placeholder want to look different on
 * every reload, and both are rendered on the server first. Randomising during
 * render would make the server's HTML disagree with the client's first render,
 * which React reports as a hydration mismatch and then throws the server's
 * markup away — so the page would flicker on every load and the pre-rendered
 * HTML a crawler reads would stop matching what a person sees.
 *
 * The rule these helpers enforce: render the canonical first item on the
 * server, shuffle only after mount. The reshuffle is invisible because it
 * happens before the first rotation.
 */

/** Fisher–Yates, on a copy. */
export function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const a = out[i] as T
    const b = out[j] as T
    out[i] = b
    out[j] = a
  }
  return out
}

/**
 * A shuffle that never opens with the item already on screen.
 *
 * Without this, a reshuffle has a 1-in-n chance of putting the same phrase
 * first, which reads as the rotation having stalled.
 */
export function shuffledAvoiding<T>(items: readonly T[], avoid: T): T[] {
  if (items.length < 2) return [...items]
  for (let attempt = 0; attempt < 8; attempt++) {
    const out = shuffled(items)
    if (out[0] !== avoid) return out
  }
  const out = shuffled(items)
  const swap = out[1] as T
  out[1] = out[0] as T
  out[0] = swap
  return out
}
