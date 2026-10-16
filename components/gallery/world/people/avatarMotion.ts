import type { CastMember } from './cast'

/**
 * How fast each walk cycle travels, in m/s, at normal speed: Rocketbox's
 * neutral walks cover 1.46 m (women's) and 1.21 m (men's) in 1.2 s.
 */
export const NATURAL_WALK: Record<CastMember['sex'], number> = { f: 1.21, m: 1.01 }

/**
 * How fast to play the walk so the feet keep pace with the ground. Slower
 * than about half speed the cycle turns into slow motion, and faster than
 * one and a half it reads as a jog, so the feet slide a little instead.
 */
export function walkRate(speed: number, sex: CastMember['sex']) {
  return Math.min(1.5, Math.max(0.6, speed / NATURAL_WALK[sex]))
}
