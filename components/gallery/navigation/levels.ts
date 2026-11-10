import { findWalkPath, type Point } from './path'
import type { GalleryRoomTemplate } from '../world/roomsData'

// A building with an upper floor keeps one walk map per floor, because a
// point (x, z) alone does not say which floor you mean. These helpers pick the
// floor from a height and, when a click is on the other floor, route there
// over the escalator.

export type Level = 0 | 1

/** Which floor a height is on. Always the ground floor in a building with only one. */
export function levelAt(y: number, template: GalleryRoomTemplate | undefined): Level {
  return template?.upper && y > template.upper.height - 0.8 ? 1 : 0
}

/**
 * The floor a click on the floor means. A point on one floor's surface is on
 * that floor; anything else (a wall hit high up, say) keeps the visitor where
 * they are, so tapping a high wall never sends them up the stairs.
 */
export function targetLevel(y: number | undefined, current: Level, template: GalleryRoomTemplate | undefined): Level {
  if (!template?.upper || y === undefined) return current
  const near = (floor: number) => Math.abs(y - floor) < 0.45
  if (near(template.upper.height)) return 1
  if (near(0)) return 0
  return current
}

function templateFor(level: Level, template: GalleryRoomTemplate): GalleryRoomTemplate {
  return level === 1 && template.upper ? template.upper.template : template
}

/**
 * Waypoints from `from` on one floor to `to` on a floor, taking the escalator
 * between them when they differ. Null when any leg can't be walked.
 */
export function planRoute(from: Point, fromLevel: Level, to: Point, toLevel: Level, garden: boolean, template: GalleryRoomTemplate, furniture: boolean): Point[] | null {
  const upper = template.upper
  if (fromLevel === toLevel || !upper) return findWalkPath(from, to, garden, templateFor(fromLevel, template), furniture)
  const { entry, exit } = upper.link
  // Walk to the escalator on this floor, ride it in a straight line, then walk on from where it lands.
  const start = fromLevel === 0 ? entry : exit
  const end = fromLevel === 0 ? exit : entry
  const first = findWalkPath(from, start, garden, templateFor(fromLevel, template), furniture)
  const last = findWalkPath(end, to, garden, templateFor(toLevel, template), furniture)
  if (!first || !last) return null
  return [...first, start, end, ...last]
}
