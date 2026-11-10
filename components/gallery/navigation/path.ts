import { VINYL } from '../vinyl/store'
import { ARCADE } from '../arcade/store'
import { mainGalleryTemplate, type GalleryRoomTemplate } from '../world/roomsData'

export type Point = { x: number; z: number }

// A half-metre floor grid is fine enough to pass a 2.4 m doorway with room
// to spare. The main gallery is about 1,400 cells; a larger walk (the MAR
// plaza) searches its own floor, capped so a broken map still ends.
const STEP = 0.5
// The player's capsule radius plus a little air, so a route never grazes a wall.
const CLEARANCE = 0.5
const FLOWER_RADIUS = 0.25
const MAX_EXPANDED = 24000

function expansionLimit(template: GalleryRoomTemplate) {
  const [minX, minZ, maxX, maxZ] = template.bounds
  const cells = Math.ceil((maxX - minX) / STEP) * Math.ceil((maxZ - minZ) / STEP)
  return Math.min(Math.max(cells, 1), MAX_EXPANDED)
}

const inBox = (point: Point, x: number, z: number, halfWidth: number, halfDepth: number) =>
  Math.abs(point.x - x) <= halfWidth + CLEARANCE && Math.abs(point.z - z) <= halfDepth + CLEARANCE

/**
 * Whether the player can stand here: inside the gallery, clear of walls and
 * (in the garden) flowers. `furniture` is the main gallery's vinyl and arcade;
 * a building that doesn't contain them passes false.
 */
export function walkable(point: Point, garden = false, template: GalleryRoomTemplate = mainGalleryTemplate, furniture = true): boolean {
  const [minX, minZ, maxX, maxZ] = template.bounds
  if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) return false
  if (point.x <= minX + CLEARANCE || point.x >= maxX - CLEARANCE || point.z <= minZ + CLEARANCE || point.z >= maxZ - CLEARANCE) return false
  if (furniture && inBox(point, VINYL.x, VINYL.z, VINYL.width / 2, VINYL.depth / 2)) return false
  if (furniture && inBox(point, ARCADE.x, ARCADE.z, ARCADE.width / 2, ARCADE.depth / 2)) return false
  if (template.floors && !template.floors.some(([x0, z0, x1, z1]) => point.x >= x0 && point.x <= x1 && point.z >= z0 && point.z <= z1)) return false
  if (template.walls.some(({ position, size }) => inBox(point, position[0], position[2], size[0] / 2, size[2] / 2))) return false
  return !garden || !template.garden.flowers.some(({ x, z }) => Math.hypot(point.x - x, point.z - z) < FLOWER_RADIUS + CLEARANCE)
}

const key = ({ x, z }: Point) => `${x},${z}`
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z)

// The walkable grid cell closest to a point, within a metre: a click right
// next to a wall still walks up to it.
function nearestCell(point: Point, garden: boolean, template: GalleryRoomTemplate, furniture: boolean): Point | null {
  let best: Point | null = null
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const cell = { x: Math.round(point.x / STEP) * STEP + dx * STEP, z: Math.round(point.z / STEP) * STEP + dz * STEP }
      if (distance(cell, point) > 1 || !walkable(cell, garden, template, furniture)) continue
      if (!best || distance(cell, point) < distance(best, point)) best = cell
    }
  }
  return best
}

// Whether the segment a→b touches a wall's box grown by CLEARANCE, exactly
// (the slab method): sampling alone can step over a box's corner.
function crossesWall(a: Point, b: Point, x: number, z: number, halfWidth: number, halfDepth: number): boolean {
  let enter = 0
  let exit = 1
  for (const [start, delta, center, half] of [[a.x, b.x - a.x, x, halfWidth + CLEARANCE], [a.z, b.z - a.z, z, halfDepth + CLEARANCE]]) {
    if (delta === 0) {
      if (Math.abs(start - center) > half) return false
      continue
    }
    const t0 = (center - half - start) / delta
    const t1 = (center + half - start) / delta
    enter = Math.max(enter, Math.min(t0, t1))
    exit = Math.min(exit, Math.max(t0, t1))
    if (enter > exit) return false
  }
  return true
}

// Nothing in the way between two points: no wall, and every 10 cm inside the
// gallery and (in the garden) away from the flowers.
function clear(a: Point, b: Point, garden: boolean, template: GalleryRoomTemplate, furniture: boolean): boolean {
  if (furniture && [VINYL, ARCADE].some(({ x, z, width, depth }) => crossesWall(a, b, x, z, width / 2, depth / 2))) return false
  if (template.walls.some(({ position, size }) => crossesWall(a, b, position[0], position[2], size[0] / 2, size[2] / 2))) return false
  const steps = Math.ceil(distance(a, b) / 0.1)
  for (let i = 1; i <= steps; i++) {
    if (!walkable({ x: a.x + ((b.x - a.x) * i) / steps, z: a.z + ((b.z - a.z) * i) / steps }, garden, template, furniture)) return false
  }
  return true
}

// Grid routes zigzag at 45°; keep only the corners a straight walk can't skip.
function straighten(path: Point[], garden: boolean, template: GalleryRoomTemplate, furniture: boolean): Point[] {
  const result = [path[0]]
  let from = 0
  while (from < path.length - 1) {
    let to = path.length - 1
    while (to > from + 1 && !clear(path[from], path[to], garden, template, furniture)) to--
    result.push(path[to])
    from = to
  }
  return result
}

function search(start: Point, goal: Point, garden: boolean, template: GalleryRoomTemplate, furniture: boolean): Point[] | null {
  const open = new Map([[key(start), start]])
  const previous = new Map<string, Point>()
  const costs = new Map([[key(start), 0]])
  const closed = new Set<string>()
  const limit = expansionLimit(template)

  while (open.size && closed.size < limit) {
    let current = start
    let bestScore = Infinity
    for (const cell of open.values()) {
      const score = costs.get(key(cell))! + distance(cell, goal)
      if (score < bestScore) {
        bestScore = score
        current = cell
      }
    }
    const currentKey = key(current)
    if (currentKey === key(goal)) {
      const path = [goal]
      while (previous.has(key(path[0]))) path.unshift(previous.get(key(path[0]))!)
      return path
    }
    open.delete(currentKey)
    closed.add(currentKey)

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (!dx && !dz) continue
        const next = { x: current.x + dx * STEP, z: current.z + dz * STEP }
        const nextKey = key(next)
        if (closed.has(nextKey) || !walkable(next, garden, template, furniture)) continue
        // No cutting a corner past a wall end.
        if (dx && dz && (!walkable({ x: next.x, z: current.z }, garden, template, furniture) || !walkable({ x: current.x, z: next.z }, garden, template, furniture))) continue
        const cost = costs.get(currentKey)! + distance(current, next)
        if (cost >= (costs.get(nextKey) ?? Infinity)) continue
        previous.set(nextKey, current)
        costs.set(nextKey, cost)
        open.set(nextKey, next)
      }
    }
  }
  return null
}

/**
 * A* over the floor grid, then straightened: the waypoints to walk from the
 * player to `to` (the exact point last when it's walkable, else the nearest
 * spot that is), without the player's own spot. Null when it can't be reached.
 */
export function findWalkPath(from: Point, to: Point, garden = false, template: GalleryRoomTemplate = mainGalleryTemplate, furniture = true): Point[] | null {
  const start = nearestCell(from, garden, template, furniture)
  const goal = nearestCell(to, garden, template, furniture)
  if (!start || !goal) return null
  const cells = search(start, goal, garden, template, furniture)
  if (!cells) return null
  const end = walkable(to, garden, template, furniture) ? to : goal
  const route = straighten([from, ...cells.slice(1, -1), end], garden, template, furniture)
  return route.slice(1)
}

/** Where to stand to look at an obra: the same spot the camera glides to when it opens. */
export function viewingSpot(artwork: { position: [number, number, number]; rotation: [number, number, number]; width: number; height: number }): Point {
  const distance = Math.max(artwork.width, artwork.height) * 0.62 + 0.75
  return { x: artwork.position[0] + Math.sin(artwork.rotation[1]) * distance, z: artwork.position[2] + Math.cos(artwork.rotation[1]) * distance }
}
