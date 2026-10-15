/** Up to here from the middle (as a fraction of half the width) the view holds still, so a click can aim. */
export const DEAD_ZONE = 0.4
/** From here out to the edge it turns at full speed. */
export const FULL_TURN = 0.9

/**
 * How fast a free cursor turns the view, -1..1 (positive to the right), from
 * where it is across the canvas (0 the left edge, 1 the right one): still
 * around the middle, then easing in towards either side.
 */
export function edgeTurn(across: number): number {
  const offset = across * 2 - 1
  const t = Math.min(1, Math.max(0, (Math.abs(offset) - DEAD_ZONE) / (FULL_TURN - DEAD_ZONE)))
  if (t === 0) return 0
  return Math.sign(offset) * t * t
}
