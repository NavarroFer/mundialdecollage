// Data-driven layout for the gallery shell — geometry components read this
// instead of hardcoding walls, so adding/reshaping a room later (or driving
// this from the admin panel) doesn't mean touching the render code.

export const WALL_HEIGHT = 3.6
export const WALL_THICKNESS = 0.2
export const DOOR_WIDTH = 2.4
export const DOOR_HEIGHT = 2.6
export const BASEBOARD_HEIGHT = 0.14
/** Free-standing panels stop short of the ceiling, so they read as exhibition partitions rather than walls. */
export const PANEL_HEIGHT = 3.2

/** Each room's glass ceiling: the room inset by `inset` on every side, with the glass `well` above the ceiling. */
export const SKYLIGHT = { inset: 1.3, well: 0.75 }

/** [minX, minZ, maxX, maxZ] on the floor. */
export type Bounds = [number, number, number, number]

export type RoomDef = {
  id: string
  name: string
  bounds: Bounds
}

// Three widths rather than three equal boxes: a narrower room for the
// collective collage, a wide entrance hall, and a third split into bays.
export const rooms: RoomDef[] = [
  { id: 'room-01', name: 'Sala 1', bounds: [-18, -5, -8, 5] },
  { id: 'room-02', name: 'Sala 2', bounds: [-8, -5, 6, 5] },
  { id: 'room-03', name: 'Sala 3', bounds: [6, -5, 18, 5] },
]

export const GALLERY_BOUNDS: Bounds = [-18, -5, 18, 5]

/** A wall as an axis-aligned box: `size` is [width(x), height(y), depth(z)]. */
export type WallSegment = {
  id: string
  position: [number, number, number]
  size: [number, number, number]
  /** A panel standing in a room with both ends open, rather than part of the shell. */
  freestanding?: true
}

/** A lintel beam over a doorway gap, plus its two jambs, as one group. */
export type Doorway = {
  id: string
  /** Gap center along the wall's running axis. */
  center: [number, number, number]
  axis: 'x' | 'z'
}

function wallAlongX(id: string, xFrom: number, xTo: number, z: number, height = WALL_HEIGHT): WallSegment {
  return {
    id,
    position: [(xFrom + xTo) / 2, height / 2, z],
    size: [xTo - xFrom, height, WALL_THICKNESS],
  }
}

function wallAlongZ(id: string, zFrom: number, zTo: number, x: number, height = WALL_HEIGHT): WallSegment {
  return {
    id,
    position: [x, height / 2, (zFrom + zTo) / 2],
    size: [WALL_THICKNESS, height, zTo - zFrom],
  }
}

const panelAlongX = (id: string, xFrom: number, xTo: number, z: number): WallSegment => ({
  ...wallAlongX(id, xFrom, xTo, z, PANEL_HEIGHT),
  freestanding: true,
})

const panelAlongZ = (id: string, zFrom: number, zTo: number, x: number): WallSegment => ({
  ...wallAlongZ(id, zFrom, zTo, x, PANEL_HEIGHT),
  freestanding: true,
})

const doorHalf = DOOR_WIDTH / 2
// Off the center line, one near the north wall and the next near the south,
// so the way through zigzags: from the hall you glimpse the next room
// instead of seeing straight to the far end of the gallery.
export const DOOR_1_2_Z = -2.4
export const DOOR_2_3_Z = 2.4

export const walls: WallSegment[] = [
  // Room 1 — dead end (west, the collective collage) + north/south perimeter
  wallAlongZ('r1-west', -5, 5, -18),
  wallAlongX('r1-north', -18, -8, -5),
  wallAlongX('r1-south', -18, -8, 5),

  // Divider 1/2, split around its doorway near the north wall
  wallAlongZ('div-1-2-a', -5, DOOR_1_2_Z - doorHalf, -8),
  wallAlongZ('div-1-2-b', DOOR_1_2_Z + doorHalf, 5, -8),

  // Room 2 — north/south perimeter (entrance hall, no dead end)
  wallAlongX('r2-north', -8, 6, -5),
  wallAlongX('r2-south', -8, 6, 5),

  // Divider 2/3, split around its doorway near the south wall
  wallAlongZ('div-2-3-a', -5, DOOR_2_3_Z - doorHalf, 6),
  wallAlongZ('div-2-3-b', DOOR_2_3_Z + doorHalf, 5, 6),

  // Room 3 — dead end (east) + north/south perimeter
  wallAlongX('r3-north', 6, 18, -5),
  wallAlongX('r3-south', 6, 18, 5),
  wallAlongZ('r3-east', -5, 5, 18),

  // Free-standing panels, hung on both faces. Room 1's stands south of the
  // sight line from its doorway to the collage, so the collage shows on the
  // way in, and closes off a small cabinet beside the door. The hall's runs
  // along the room and opens a corridor toward Room 3's door. Room 3's two
  // are staggered, splitting it into three bays walked in a zigzag.
  panelAlongZ('panel-1', 0, 3, -11.5),
  panelAlongX('panel-2', -3.5, 1.5, 1.8),
  panelAlongZ('panel-3a', -1.5, 3, 10.5),
  panelAlongZ('panel-3b', -3, 1.5, 14.5),
]

export const doorways: Doorway[] = [
  { id: 'door-1-2', center: [-8, 0, DOOR_1_2_Z], axis: 'z' },
  { id: 'door-2-3', center: [6, 0, DOOR_2_3_Z], axis: 'z' },
]

/** The garden theme's flowers, along the walls. */
export const GARDEN_FLOWERS = [
  { x: -16, z: -4.25, color: '#ef6f61' },
  { x: -13.2, z: 4.25, color: '#ffd23f' },
  { x: -9, z: -4.25, color: '#8f67b1' },
  { x: -3.5, z: 4.25, color: '#ef6f61' },
  { x: 2.5, z: -4.25, color: '#ff8f3d' },
  { x: 4.7, z: 4.25, color: '#8f67b1' },
  { x: 8.5, z: -4.25, color: '#ffd23f' },
  { x: 13, z: 4.25, color: '#ef6f61' },
  { x: 16.2, z: -4.25, color: '#ff8f3d' },
]

/** The garden theme's sand path: through both doorways, then up and down Room 3's bays. */
export const GARDEN_PATH: [number, number][] = [
  [-15.5, 0.6],
  [-15.5, DOOR_1_2_Z],
  [3.5, DOOR_1_2_Z],
  [3.5, DOOR_2_3_Z],
  [8.2, DOOR_2_3_Z],
  [8.2, -3.2],
  [12.5, -3.2],
  [12.5, 3.2],
  [16.3, 3.2],
  [16.3, -2.6],
]

/** A room's skylight opening. */
export function skylightOf({ bounds: [minX, minZ, maxX, maxZ] }: RoomDef): Bounds {
  const { inset } = SKYLIGHT
  return [minX + inset, minZ + inset, maxX - inset, maxZ - inset]
}

/**
 * The ceiling around the skylights, as rectangles. Every room spans the
 * gallery's full depth, so all the openings share one band across it.
 */
export function ceilingAroundSkylights(): Bounds[] {
  const [minX, minZ, maxX, maxZ] = GALLERY_BOUNDS
  const openings = rooms.map(skylightOf).sort((a, b) => a[0] - b[0])
  const [, top, , bottom] = openings[0]
  const panels: Bounds[] = [
    [minX, minZ, maxX, top],
    [minX, bottom, maxX, maxZ],
  ]
  let x = minX
  for (const [x0, , x1] of openings) {
    panels.push([x, top, x0, bottom])
    x = x1
  }
  panels.push([x, top, maxX, bottom])
  return panels
}
