import { GALLERY_BOUNDS, GARDEN_FLOWERS, walls } from '../world/roomsData'

export type Point = { x: number; z: number }

// A half-metre floor grid is fine enough to pass a 2.4 m doorway with room
// to spare, and small enough (≈1,400 cells) to search in well under a frame.
const STEP = 0.5
// The player's capsule radius plus a little air, so a route never grazes a wall.
const CLEARANCE = 0.5
const FLOWER_RADIUS = 0.25
// A broken map can't keep the search going forever.
const MAX_EXPANDED = 2000

const [minX, minZ, maxX, maxZ] = GALLERY_BOUNDS

const inBox = (point: Point, x: number, z: number, halfWidth: number, halfDepth: number) =>
  Math.abs(point.x - x) <= halfWidth + CLEARANCE && Math.abs(point.z - z) <= halfDepth + CLEARANCE

/** Whether the player can stand here: inside the gallery, clear of walls and (in the garden) flowers. */
export function walkable(point: Point, garden = false): boolean {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) return false
  if (point.x <= minX + CLEARANCE || point.x >= maxX - CLEARANCE || point.z <= minZ + CLEARANCE || point.z >= maxZ - CLEARANCE) return false
  if (walls.some(({ position, size }) => inBox(point, position[0], position[2], size[0] / 2, size[2] / 2))) return false
  return !garden || !GARDEN_FLOWERS.some(({ x, z }) => Math.hypot(point.x - x, point.z - z) < FLOWER_RADIUS + CLEARANCE)
}

const key = ({ x, z }: Point) => `${x},${z}`
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z)

// The walkable grid cell closest to a point, within a metre: a click right
// next to a wall still walks up to it.
function nearestCell(point: Point, garden: boolean): Point | null {
  let best: Point | null = null
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const cell = { x: Math.round(point.x / STEP) * STEP + dx * STEP, z: Math.round(point.z / STEP) * STEP + dz * STEP }
      if (distance(cell, point) > 1 || !walkable(cell, garden)) continue
      if (!best || distance(cell, point) < distance(best, point)) best = cell
    }
  }
  return best
}

// Nothing in the way between two points, checked every 10 cm.
function clear(a: Point, b: Point, garden: boolean): boolean {
  const steps = Math.ceil(distance(a, b) / 0.1)
  for (let i = 1; i <= steps; i++) {
    if (!walkable({ x: a.x + ((b.x - a.x) * i) / steps, z: a.z + ((b.z - a.z) * i) / steps }, garden)) return false
  }
  return true
}

// Grid routes zigzag at 45°; keep only the corners a straight walk can't skip.
function straighten(path: Point[], garden: boolean): Point[] {
  const result = [path[0]]
  let from = 0
  while (from < path.length - 1) {
    let to = path.length - 1
    while (to > from + 1 && !clear(path[from], path[to], garden)) to--
    result.push(path[to])
    from = to
  }
  return result
}

function search(start: Point, goal: Point, garden: boolean): Point[] | null {
  const open = new Map([[key(start), start]])
  const previous = new Map<string, Point>()
  const costs = new Map([[key(start), 0]])
  const closed = new Set<string>()

  while (open.size && closed.size < MAX_EXPANDED) {
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
        if (closed.has(nextKey) || !walkable(next, garden)) continue
        // No cutting a corner past a wall end.
        if (dx && dz && (!walkable({ x: next.x, z: current.z }, garden) || !walkable({ x: current.x, z: next.z }, garden))) continue
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
export function findWalkPath(from: Point, to: Point, garden = false): Point[] | null {
  const start = nearestCell(from, garden)
  const goal = nearestCell(to, garden)
  if (!start || !goal) return null
  const cells = search(start, goal, garden)
  if (!cells) return null
  const end = walkable(to, garden) ? to : goal
  const route = straighten([from, ...cells.slice(1, -1), end], garden)
  return route.slice(1)
}

/** Where to stand to look at an obra: the same spot the camera glides to when it opens. */
export function viewingSpot(artwork: { position: [number, number, number]; rotation: [number, number, number]; width: number; height: number }): Point {
  const distance = Math.max(artwork.width, artwork.height) * 0.62 + 0.75
  return { x: artwork.position[0] + Math.sin(artwork.rotation[1]) * distance, z: artwork.position[2] + Math.cos(artwork.rotation[1]) * distance }
}
