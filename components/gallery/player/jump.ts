// About half a metre of hop under Rapier's default gravity (v = √(2gh)).
export const JUMP_SPEED = 3.2
const GRAVITY = 9.81

/** From leaving the floor to landing on it again. */
export const HOP_SECONDS = (2 * JUMP_SPEED) / GRAVITY

/**
 * How high a hop is this long after leaving the floor: the arc the player's
 * body follows, so other visitors see the same jump. 0 before and after.
 */
export function hopHeight(seconds: number) {
  if (seconds <= 0 || seconds >= HOP_SECONDS) return 0
  return JUMP_SPEED * seconds - (GRAVITY * seconds * seconds) / 2
}
