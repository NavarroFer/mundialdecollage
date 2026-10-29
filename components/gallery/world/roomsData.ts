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

export const CLUB_GALLERY_TEMPLATE_IDS = ['cabinet', 'classic', 'double'] as const
export type ClubGalleryTemplateId = (typeof CLUB_GALLERY_TEMPLATE_IDS)[number]

export type GalleryRoomTemplate = {
  id: 'main' | ClubGalleryTemplateId
  capacity: number
  bounds: Bounds
  rooms: RoomDef[]
  walls: WallSegment[]
  doorways: Doorway[]
  /** Optional garden dressing. Other themes ignore these points. */
  garden: {
    flowers: Array<{ x: number; z: number; color: string }>
    path: Array<[number, number]>
  }
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

const CLUB_FLOWER_COLORS = ['#ef6f61', '#ffd23f', '#8f67b1', '#ff8f3d']

function flowersAlong(bounds: Bounds) {
  const [minX, minZ, maxX, maxZ] = bounds
  const inset = 0.72
  const xs = [minX + 1.4, (minX + maxX) / 2, maxX - 1.4]
  return xs.flatMap((x, index) => [
    { x, z: minZ + inset, color: CLUB_FLOWER_COLORS[index % CLUB_FLOWER_COLORS.length] },
    { x, z: maxZ - inset, color: CLUB_FLOWER_COLORS[(index + 1) % CLUB_FLOWER_COLORS.length] },
  ])
}

const cabinetBounds: Bounds = [-5, -4, 5, 4]
const cabinetWalls: WallSegment[] = [
  wallAlongX('cabinet-north', -5, 5, -4),
  wallAlongX('cabinet-south-west', -5, -doorHalf, 4),
  wallAlongX('cabinet-south-east', doorHalf, 5, 4),
  wallAlongZ('cabinet-west', -4, 4, -5),
  wallAlongZ('cabinet-east', -4, 4, 5),
]

const classicBounds: Bounds = [-8, -5, 8, 5]
const classicWalls: WallSegment[] = [
  wallAlongX('classic-north', -8, 8, -5),
  wallAlongX('classic-south-west', -8, -doorHalf, 5),
  wallAlongX('classic-south-east', doorHalf, 8, 5),
  wallAlongZ('classic-west', -5, 5, -8),
  wallAlongZ('classic-east', -5, 5, 8),
  panelAlongZ('classic-panel', -2.5, 2.5, 0),
]

const doubleBounds: Bounds = [-12, -5, 12, 5]
const doubleDoorZ = 2.4
const doubleWalls: WallSegment[] = [
  wallAlongX('double-north', -12, 12, -5),
  wallAlongX('double-south-west', -12, -doorHalf, 5),
  wallAlongX('double-south-east', doorHalf, 12, 5),
  wallAlongZ('double-west', -5, 5, -12),
  wallAlongZ('double-east', -5, 5, 12),
  wallAlongZ('double-divider-north', -5, doubleDoorZ - doorHalf, 0),
  wallAlongZ('double-divider-south', doubleDoorZ + doorHalf, 5, 0),
  panelAlongZ('double-panel-west', -2.6, 1.2, -6),
  panelAlongZ('double-panel-east', -2.6, 1.2, 6),
]

export const clubGalleryTemplates: Record<ClubGalleryTemplateId, GalleryRoomTemplate> = {
  cabinet: {
    id: 'cabinet',
    capacity: 8,
    bounds: cabinetBounds,
    rooms: [{ id: 'club-room-01', name: 'Sala Gabinete', bounds: cabinetBounds }],
    walls: cabinetWalls,
    doorways: [{ id: 'cabinet-entrance', center: [0, 0, 4], axis: 'x' }],
    garden: {
      flowers: flowersAlong(cabinetBounds),
      path: [[0, 3.7], [0, 0], [-3.5, 0], [3.5, 0]],
    },
  },
  classic: {
    id: 'classic',
    capacity: 14,
    bounds: classicBounds,
    rooms: [{ id: 'club-room-01', name: 'Sala Clásica', bounds: classicBounds }],
    walls: classicWalls,
    doorways: [{ id: 'classic-entrance', center: [0, 0, 5], axis: 'x' }],
    garden: {
      flowers: flowersAlong(classicBounds),
      path: [[0, 4.7], [3.2, 3.2], [3.2, -3.2], [-3.2, -3.2], [-3.2, 3.2], [0, 4.7]],
    },
  },
  double: {
    id: 'double',
    capacity: 22,
    bounds: doubleBounds,
    rooms: [
      { id: 'club-room-01', name: 'Sala 1', bounds: [-12, -5, 0, 5] },
      { id: 'club-room-02', name: 'Sala 2', bounds: [0, -5, 12, 5] },
    ],
    walls: doubleWalls,
    doorways: [
      { id: 'double-entrance', center: [0, 0, 5], axis: 'x' },
      { id: 'double-passage', center: [0, 0, doubleDoorZ], axis: 'z' },
    ],
    garden: {
      flowers: flowersAlong(doubleBounds),
      path: [[0, 4.7], [-3.2, 3.1], [-9.5, 3.1], [-9.5, -3.1], [-2.2, -3.1], [-2.2, doubleDoorZ], [2.2, doubleDoorZ], [2.2, -3.1], [9.5, -3.1], [9.5, 3.1]],
    },
  },
}

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
  { x: 15.2, z: -4.25, color: '#ff8f3d' },
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

export const mainGalleryTemplate: GalleryRoomTemplate = {
  id: 'main',
  capacity: 37,
  bounds: GALLERY_BOUNDS,
  rooms,
  walls,
  doorways,
  garden: { flowers: GARDEN_FLOWERS, path: GARDEN_PATH },
}

/** A room's skylight opening. */
export function skylightOf({ bounds: [minX, minZ, maxX, maxZ] }: RoomDef): Bounds {
  const { inset } = SKYLIGHT
  return [minX + inset, minZ + inset, maxX - inset, maxZ - inset]
}

/**
 * The ceiling around the skylights, as rectangles. Every room spans the
 * gallery's full depth, so all the openings share one band across it.
 */
export function ceilingAroundSkylights(template: GalleryRoomTemplate = mainGalleryTemplate): Bounds[] {
  const [minX, minZ, maxX, maxZ] = template.bounds
  const openings = template.rooms.map(skylightOf).sort((a, b) => a[0] - b[0])
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
