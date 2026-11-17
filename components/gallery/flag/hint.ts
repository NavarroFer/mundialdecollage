import { FLAG, FLAG_AT } from '../world/mar/mosaic'

/** Closer than this to the flag, in metres across the floor, the floating hand shows… */
export const HINT_NEAR = 9
/** …and it only goes further than this, so it doesn't flicker at the edge. */
export const HINT_FAR = 10.5

/** Keep the hand this far inside the cloth's top and foot. */
const EDGE = 0.6
/** Just off the cloth on the visitor's side, clear of its folds. */
const OFF_CLOTH = 0.25

/** How far a visitor at (x, z) is from the flag, across the floor. */
export const flagDistance = (x: number, z: number) => Math.hypot(x - FLAG_AT.x, z - FLAG_AT.z)

/** Whether the hand shows for a visitor `distance` metres from the flag, given whether it shows already. */
export const nearFlag = (distance: number, shown: boolean) => distance <= (shown ? HINT_FAR : HINT_NEAR)

/**
 * Where the hand floats: over the middle of the cloth at the visitor's eye
 * height (kept on the cloth, so on the upper floor too), just off it on the
 * side they look at it from.
 */
export function hintAnchor(eye: { y: number; z: number }) {
  const y = Math.min(Math.max(eye.y - 0.15, FLAG.bottom + EDGE), FLAG.bottom + FLAG.height - EDGE)
  const side = eye.z >= FLAG_AT.z ? 1 : -1
  return { x: FLAG_AT.x, y, z: FLAG_AT.z + side * OFF_CLOTH }
}
