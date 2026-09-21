// Data-driven layout for the gallery shell — geometry components read this
// instead of hardcoding walls, so adding/reshaping a room later (or driving
// this from the admin panel) doesn't mean touching the render code.

export const WALL_HEIGHT = 3.6
export const WALL_THICKNESS = 0.2
export const DOOR_WIDTH = 2.4
export const DOOR_HEIGHT = 2.6

export type RoomDef = {
  id: string
  name: string
  /** [minX, minZ, maxX, maxZ] floor bounds. */
  bounds: [number, number, number, number]
}

export const rooms: RoomDef[] = [
  { id: 'room-01', name: 'Sala 1', bounds: [-18, -5, -6, 5] },
  { id: 'room-02', name: 'Sala 2', bounds: [-6, -5, 6, 5] },
  { id: 'room-03', name: 'Sala 3', bounds: [6, -5, 18, 5] },
]

export const GALLERY_BOUNDS: [number, number, number, number] = [-18, -5, 18, 5]

/** A wall as an axis-aligned box: `size` is [width(x), height(y), depth(z)]. */
export type WallSegment = {
  id: string
  position: [number, number, number]
  size: [number, number, number]
}

/** A lintel beam over a doorway gap, plus its two jambs, as one group. */
export type Doorway = {
  id: string
  /** Gap center along the wall's running axis. */
  center: [number, number, number]
  axis: 'x' | 'z'
}

const halfHeight = WALL_HEIGHT / 2

function wallAlongX(id: string, xFrom: number, xTo: number, z: number): WallSegment {
  return {
    id,
    position: [(xFrom + xTo) / 2, halfHeight, z],
    size: [xTo - xFrom, WALL_HEIGHT, WALL_THICKNESS],
  }
}

function wallAlongZ(id: string, zFrom: number, zTo: number, x: number): WallSegment {
  return {
    id,
    position: [x, halfHeight, (zFrom + zTo) / 2],
    size: [WALL_THICKNESS, WALL_HEIGHT, zTo - zFrom],
  }
}

const doorHalf = DOOR_WIDTH / 2

export const walls: WallSegment[] = [
  // Room 1 — dead end (west) + north/south perimeter
  wallAlongZ('r1-west', -5, 5, -18),
  wallAlongX('r1-north', -18, -6, -5),
  wallAlongX('r1-south', -18, -6, 5),

  // Divider 1/2, split around the doorway
  wallAlongZ('div-1-2-a', -5, -doorHalf, -6),
  wallAlongZ('div-1-2-b', doorHalf, 5, -6),

  // Room 2 — north/south perimeter (entrance hall, no dead end)
  wallAlongX('r2-north', -6, 6, -5),
  wallAlongX('r2-south', -6, 6, 5),

  // Divider 2/3, split around the doorway
  wallAlongZ('div-2-3-a', -5, -doorHalf, 6),
  wallAlongZ('div-2-3-b', doorHalf, 5, 6),

  // Room 3 — dead end (east) + north/south perimeter
  wallAlongX('r3-north', 6, 18, -5),
  wallAlongX('r3-south', 6, 18, 5),
  wallAlongZ('r3-east', -5, 5, 18),
]

export const doorways: Doorway[] = [
  { id: 'door-1-2', center: [-6, 0, 0], axis: 'z' },
  { id: 'door-2-3', center: [6, 0, 0], axis: 'z' },
]
