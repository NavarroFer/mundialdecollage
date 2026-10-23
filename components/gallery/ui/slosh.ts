// The volume tank's liquid, after React Bits' Slosh Gauge
// (reactbits.dev/micro/slosh-gauge): a spring chases the level, its surface
// leans with the speed and it bounces off the tank's top and bottom.

export type Slosh = { level: number; speed: number }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Fixed sub-step, so a slow frame moves the liquid the same as two fast ones. */
const SUBSTEP = 1 / 120
const STIFFNESS = 1067
/** Under 1 it overshoots and comes back: the slosh. */
const DAMPING_RATIO = 0.23
/** Speed kept when it hits an end, the other way round. */
const SPLASH = 0.42
/** Degrees the surface leans per level-point per second, up to TILT_MAX. */
const TILT = 0.03
const TILT_MAX = 30

/** Moves `slosh` toward `target` (0–100) over `seconds`. `calm` (reduced motion) neither overshoots nor splashes. */
export function sloshStep(slosh: Slosh, target: number, seconds: number, calm: boolean) {
  const damping = 2 * (calm ? 1 : DAMPING_RATIO) * Math.sqrt(STIFFNESS)
  const bounce = calm ? 0 : SPLASH
  for (let steps = Math.ceil(seconds / SUBSTEP), h = seconds / steps; steps > 0; steps -= 1) {
    slosh.speed = slosh.speed * Math.exp(-damping * h) + STIFFNESS * (target - slosh.level) * h
    slosh.level += slosh.speed * h
    if (slosh.level > 100 || slosh.level < 0) {
      slosh.level = clamp(slosh.level, 0, 100)
      slosh.speed = -slosh.speed * bounce
    }
  }
}

/** Close and slow enough to stop drawing frames. */
export const sloshSettled = (slosh: Slosh, target: number) => Math.abs(target - slosh.level) < 0.05 && Math.abs(slosh.speed) < 2

/** How far the surface leans, in degrees (positive: rising). */
export const sloshTilt = (slosh: Slosh, calm: boolean) => (calm ? 0 : clamp(slosh.speed * TILT, -TILT_MAX, TILT_MAX))
