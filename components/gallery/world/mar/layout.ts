// Provisional geometry for Museo MAR (Mar del Plata). Every metre here is an
// estimate: the plan and sections establish the arrangement, not a survey.
// What was read off the sheets versus what was guessed is written up in
// docs/mar-gallery.md. Change a number here and the mesh, the collider, the
// walk map and the hanging spots move together.

import { hang, type GallerySlot, type Hanging } from '@/data/artworks'
import type { GalleryRoomTemplate, WallSegment } from '../roomsData'

export type MarKind = 'concrete' | 'deck' | 'white' | 'glass' | 'seat' | 'table' | 'curb' | 'trunk'

export type MarBox = {
  id: string
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
  kind: MarKind
  /** When set, forces the box in or out of the 2D walk map. */
  path?: boolean
  /** False for a walk-map obstacle that is not a physical wall (the escalator lane). */
  solid?: boolean
  freestanding?: true
}

/** Metres. All of these are provisional — see docs/mar-gallery.md. */
export const MAR = {
  /** Facade panel module. The joints are visible; their spacing is not dimensioned on the sheets. */
  panel: { width: 2.4, height: 1.2 },
  /** Cobble module on the plaza. */
  cobble: 1.5,
  wall: 0.28,
  /** Clear height of the central doors. The photos show a full-height glass wall with a door bank under a head. */
  doorHeight: 3.2,
  /** Double-height hall, floor to ceiling. The mezzanine sits about halfway up in the interior photo. */
  hallHeight: 9,
  /** Walk surface of the mezzanine. */
  mezzanine: 4.45,
  westInterior: 5.2,
  /** Left volume, taller than the entrance, with an upper window band. */
  westExterior: 11.4,
  eastInterior: 5.6,
  /** Right volume, the one carrying the MAR letters. */
  eastExterior: 8.6,
  auditorium: 7.4,
  /** How thick a temporary exhibition partition reads. */
  partition: 0.12,
  partitionHeight: 3.05,
} as const

const T = MAR.wall

export const MAR_DOORS = {
  /** South glass wall of the hall, the only way in from the plaza. */
  entrance: { x0: -2.6, x1: 2.6, z: 0 },
  west: { x: -12, z0: -3.45, z1: -0.35 },
  east: { x: 14, z0: -13.6, z1: -10.4 },
  auditorium: { z: -20, x0: -1.6, x1: 2.4 },
} as const

/** Where a visit to MAR starts: on the plaza, facing the entrance (yaw 0 looks toward -Z). */
export const MAR_SPAWN = { x: 0, z: 16, yaw: 0 }

/**
 * The two escalators on the east side of the hall. zBottom is the plaza end
 * (height 0); zTop meets the mezzanine. Rise and run are provisional.
 */
export const MAR_ESCALATORS = [
  { id: 'up', x0: 7.45, x1: 8.9, zBottom: -1.15, zTop: -8.2, rise: MAR.mezzanine },
  { id: 'down', x0: 9.15, x1: 10.6, zBottom: -1.15, zTop: -8.2, rise: MAR.mezzanine },
] as const

/** Height of the escalator deck at this floor point, or null when you're beside it. */
export function marEscalatorHeight(x: number, z: number): number | null {
  for (const lane of MAR_ESCALATORS) {
    if (x < lane.x0 || x > lane.x1 || z > lane.zBottom || z < lane.zTop) continue
    const span = lane.zBottom - lane.zTop
    return (lane.rise * (lane.zBottom - z)) / span
  }
  return null
}

function box(
  id: string,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
  kind: MarKind,
  extra: Partial<Pick<MarBox, 'path' | 'solid' | 'freestanding'>> = {},
): MarBox {
  return { id, minX, maxX, minY, maxY, minZ, maxZ, kind, ...extra }
}

/** A wall running along X, centered on z. */
function wallX(id: string, x0: number, x1: number, z: number, y1: number, kind: MarKind = 'concrete', thickness: number = T): MarBox {
  return box(id, x0, 0, z - thickness / 2, x1, y1, z + thickness / 2, kind)
}

/** A wall running along Z, centered on x. */
function wallZ(id: string, z0: number, z1: number, x: number, y1: number, kind: MarKind = 'concrete', thickness: number = T): MarBox {
  return box(id, x - thickness / 2, 0, z0, x + thickness / 2, y1, z1, kind)
}

const H = MAR.hallHeight
const WEST_H = MAR.westExterior
const EAST_H = MAR.eastExterior
const AUD_H = MAR.auditorium

/**
 * Permanent structure, temporary partitions, glass, and the site edge.
 * `path: true` on the escalator lane keeps click-to-walk from cutting across
 * it; the lane itself has no solid, so walking onto it still climbs.
 */
export const marBoxes: MarBox[] = [
  // Hall, double height. The south side is glass (below), not a concrete wall.
  wallX('mar-hall-n-w', -12, MAR_DOORS.auditorium.x0, MAR_DOORS.auditorium.z, H),
  wallX('mar-hall-n-e', MAR_DOORS.auditorium.x1, 14, MAR_DOORS.auditorium.z, H),
  wallZ('mar-hall-w-n', -20, -12, -12, H),
  wallZ('mar-west-e-n', -12, MAR_DOORS.west.z0, MAR_DOORS.west.x, H),
  wallZ('mar-west-e-s', MAR_DOORS.west.z1, 8, MAR_DOORS.west.x, WEST_H),
  wallZ('mar-hall-e-n', -20, MAR_DOORS.east.z0, MAR_DOORS.east.x, H),
  wallZ('mar-hall-e-s', MAR_DOORS.east.z1, -7.8, MAR_DOORS.east.x, H),
  wallZ('mar-hall-e-pier', -0.2, 0, 14, H),

  // West exhibition volume. Ground floor glazed to the plaza; concrete above.
  wallZ('mar-west-w', -12, 8, -30, WEST_H),
  wallX('mar-west-n', -30, -12, -12, WEST_H),
  wallX('mar-west-s-glass', -30, -12, 8, 3.4, 'glass'),
  box('mar-west-s-up', -30, 3.4, 8 - T / 2, -12, WEST_H, 8 + T / 2, 'concrete'),
  // Upper floor cantilever toward the plaza, above head height.
  box('mar-west-cantilever', -26, 5.6, 8, -14, WEST_H, 12.2, 'concrete'),

  // East exhibition room.
  wallX('mar-east-n', 14, 32, -18, EAST_H),
  wallX('mar-east-s', 14, 32, -8, EAST_H),
  wallZ('mar-east-e', -18, -8, 32, EAST_H),

  // Right-hand concrete volume on the plaza, with the MAR letters on its south face.
  box('mar-east-mass', 8, 0, 0.15, 28, EAST_H, 5.6, 'concrete'),

  // Auditorium block north of the hall.
  wallX('mar-aud-n', -8, 16, -38, AUD_H),
  wallZ('mar-aud-w', -38, -20, -8, AUD_H),
  wallZ('mar-aud-e', -38, -20, 16, AUD_H),
  wallX('mar-aud-s-e', 14, 16, -20, AUD_H),
  // Seat banks leave an aisle on the door (x -1.6..2.4) and a second aisle further east.
  box('mar-seat-w', -6.6, 0, -36.2, -1.7, 0.55, -23.6, 'seat'),
  box('mar-seat-m', 3.2, 0, -36.2, 9.4, 0.55, -23.6, 'seat'),
  box('mar-seat-e', 11.3, 0, -36.2, 14.6, 0.55, -23.6, 'seat'),
  box('mar-stage', -6.2, 0, -37.7, 14.6, 0.62, -36.2, 'seat'),

  // South glass of the hall: sea and plaza beyond, with the entrance cut out.
  wallX('mar-hall-s-w', -12, MAR_DOORS.entrance.x0, 0, H, 'glass', 0.08),
  wallX('mar-hall-s-e', MAR_DOORS.entrance.x1, 8.05, 0, H, 'glass', 0.08),
  box('mar-hall-s-transom', MAR_DOORS.entrance.x0, MAR.doorHeight, -0.04, MAR_DOORS.entrance.x1, H, 0.04, 'glass'),
  // East window of the hall, toward the trees. A sill, not a door.
  box('mar-hall-window-e', 14 - 0.04, 0.35, -7.8, 14 + 0.04, 8.2, -0.2, 'glass'),

  // Temporary white partitions. They are a typical exhibition fit-out, not a copy of a particular show.
  wallZ('mar-west-p1', -7, 2, -21, MAR.partitionHeight, 'white', MAR.partition),
  wallX('mar-east-p1', 20, 28.5, -13, MAR.partitionHeight, 'white', MAR.partition),

  // Mezzanine deck and glass balustrade around the void. Above the walk, so the ground floor stays open.
  box('mar-bridge', -6, MAR.mezzanine - 0.25, -13.2, 6.5, MAR.mezzanine, -8.2, 'deck'),
  box('mar-landing', 6.5, MAR.mezzanine - 0.25, -17.5, 13.86, MAR.mezzanine, -8.2, 'deck'),
  box('mar-rail-bridge-w', -6.08, MAR.mezzanine, -13.2, -5.96, MAR.mezzanine + 1.1, -8.2, 'glass'),
  box('mar-rail-bridge-n', -6, MAR.mezzanine, -13.28, 6.5, MAR.mezzanine + 1.1, -13.16, 'glass'),
  box('mar-rail-bridge-s', -6, MAR.mezzanine, -8.28, 6.5, MAR.mezzanine + 1.1, -8.16, 'glass'),
  box('mar-rail-land-w', 6.46, MAR.mezzanine, -17.5, 6.58, MAR.mezzanine + 1.1, -13.2, 'glass'),
  box('mar-rail-land-n', 6.5, MAR.mezzanine, -17.58, 13.86, MAR.mezzanine + 1.1, -17.46, 'glass'),
  box('mar-rail-land-s-w', 6.5, MAR.mezzanine, -8.28, 7.25, MAR.mezzanine + 1.1, -8.16, 'glass'),
  box('mar-rail-land-s-e', 10.8, MAR.mezzanine, -8.28, 13.86, MAR.mezzanine + 1.1, -8.16, 'glass'),

  // Escalator side rails. The lanes themselves are open so you can walk on.
  box('mar-esc-rail-w', 7.15, 0, -7.5, 7.4, 1.15, -1.7, 'concrete'),
  box('mar-esc-rail-m', 8.95, 0, -7.5, 9.12, 1.15, -1.7, 'concrete'),
  box('mar-esc-rail-e', 10.65, 0, -7.5, 10.9, 1.15, -1.7, 'concrete'),
  // Click-to-walk goes around the lanes; walking onto them still climbs.
  box('mar-esc-lane', 7.15, 0, -8.25, 10.9, 1.2, -1.1, 'concrete', { path: true, solid: false }),

  // Shallow basin on the side plaza.
  wallX('mar-pool-n', -27.6, -16.4, 12.15, 0.42, 'concrete', 0.35),
  wallX('mar-pool-s', -27.6, -16.4, 19.85, 0.42, 'concrete', 0.35),
  wallZ('mar-pool-w', 12.15, 19.85, -27.6, 0.42, 'concrete', 0.35),
  wallZ('mar-pool-e', 12.15, 19.85, -16.4, 0.42, 'concrete', 0.35),

  // A few tables on the east terrace (the plan's scattered tables).
  box('mar-table-a', 33.2, 0, 6.6, 34.5, 0.76, 7.9, 'table'),
  box('mar-table-b', 35.6, 0, 11.1, 36.9, 0.76, 12.4, 'table'),
  box('mar-table-c', 32.5, 0, 14.3, 33.8, 0.76, 15.6, 'table'),

  // Benches on the approach.
  box('mar-bench-w', -7.4, 0, 9.3, -5.2, 0.46, 10.05, 'seat'),
  box('mar-bench-e', 4.3, 0, 10.6, 6.5, 0.46, 11.35, 'seat'),

  // Trees beyond the cobble.
  box('mar-tree-a', -32.2, 0, 25.8, -31.8, 2.4, 26.2, 'trunk'),
  box('mar-tree-b', -18.2, 0, 27.8, -17.8, 2.4, 28.2, 'trunk'),
  box('mar-tree-c', 5.8, 0, 26.8, 6.2, 2.4, 27.2, 'trunk'),
  box('mar-tree-d', 21.8, 0, 25.8, 22.2, 2.4, 26.2, 'trunk'),
  box('mar-tree-e', 33.8, 0, 22.8, 34.2, 2.4, 23.2, 'trunk'),

  // Edge of the modeled site, not a wall of the museum. Low enough to see over, high enough that a hop stays inside.
  wallX('mar-curb-s', -36, 40, 32, 0.7, 'curb', 0.4),
  wallX('mar-curb-n', -36, 40, -42, 0.7, 'curb', 0.4),
  wallZ('mar-curb-w', -42, 32, -36, 0.7, 'curb', 0.4),
  wallZ('mar-curb-e', -42, 32, 40, 0.7, 'curb', 0.4),
]

export function blocksPath(box: MarBox): boolean {
  if (box.path === false) return false
  if (box.path === true) return true
  return box.minY < 1.5 && box.maxY > 0.35
}

export function blocksBody(box: MarBox): boolean {
  return box.solid !== false
}

export function marCenter(box: MarBox): [number, number, number] {
  return [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2, (box.minZ + box.maxZ) / 2]
}

export function marSize(box: MarBox): [number, number, number] {
  return [box.maxX - box.minX, box.maxY - box.minY, box.maxZ - box.minZ]
}

function toWall(box: MarBox): WallSegment {
  return {
    id: box.id,
    position: marCenter(box),
    size: marSize(box),
    ...(box.freestanding ? { freestanding: true as const } : {}),
  }
}

const partitionIds = new Set(['mar-west-p1', 'mar-east-p1'])

export const marWalls: WallSegment[] = marBoxes.filter(blocksPath).map((box) => toWall(partitionIds.has(box.id) ? { ...box, freestanding: true } : box))

/** Floors are visual only. The walk surface is one slab at y = 0, so the threshold has no lip. */
export const marFloors = [
  { id: 'cobble', kind: 'cobble' as const, x0: -36, x1: 40, z0: 0, z1: 23 },
  { id: 'grass', kind: 'grass' as const, x0: -36, x1: 40, z0: 23, z1: 32 },
  { id: 'hall', kind: 'polish' as const, x0: -11.84, x1: 13.84, z0: -19.84, z1: 0.2 },
  { id: 'west', kind: 'gallery' as const, x0: -29.84, x1: -12.16, z0: -11.84, z1: 7.84 },
  { id: 'east', kind: 'dark' as const, x0: 14.16, x1: 31.84, z0: -17.84, z1: -8.16 },
  { id: 'auditorium', kind: 'auditorium' as const, x0: -7.84, x1: 15.84, z0: -37.84, z1: -20.16 },
]

const MAR_BOUNDS = [-36, -42, 40, 32] as [number, number, number, number]

export const marRooms = [
  { id: 'mar-plaza', name: 'Plaza', bounds: [-36, 0, 40, 32] as [number, number, number, number] },
  { id: 'mar-hall', name: 'Hall', bounds: [-12, -20, 14, 0] as [number, number, number, number] },
  { id: 'mar-west', name: 'Sala oeste', bounds: [-30, -12, -12, 8] as [number, number, number, number] },
  { id: 'mar-east', name: 'Sala este', bounds: [14, -18, 32, -8] as [number, number, number, number] },
  { id: 'mar-auditorium', name: 'Auditorio', bounds: [-8, -38, 16, -20] as [number, number, number, number] },
]

export const marGalleryTemplate: GalleryRoomTemplate = {
  id: 'mar',
  capacity: 37,
  bounds: MAR_BOUNDS,
  rooms: marRooms,
  walls: marWalls,
  doorways: [
    { id: 'mar-entrance', center: [0, 0, 0], axis: 'x' },
    { id: 'mar-west', center: [MAR_DOORS.west.x, 0, (MAR_DOORS.west.z0 + MAR_DOORS.west.z1) / 2], axis: 'z' },
    { id: 'mar-east', center: [MAR_DOORS.east.x, 0, (MAR_DOORS.east.z0 + MAR_DOORS.east.z1) / 2], axis: 'z' },
    { id: 'mar-auditorium', center: [(MAR_DOORS.auditorium.x0 + MAR_DOORS.auditorium.x1) / 2, 0, MAR_DOORS.auditorium.z], axis: 'x' },
  ],
  garden: { flowers: [], path: [] },
}

// Same hanging helper as the Collage World Cup rooms. Counts sum to 37, the
// daily exhibition's wall count, so a full day still has a spot each.
export const MAR_HANGINGS: Hanging[] = [
  { roomId: 'mar-west', wall: 'mar-west-n', facing: 'south', count: 4, presetOffset: 0 },
  { roomId: 'mar-west', wall: 'mar-west-w', facing: 'east', count: 4, presetOffset: 1 },
  { roomId: 'mar-west', wall: 'mar-west-e-n', facing: 'west', count: 2, presetOffset: 2 },
  { roomId: 'mar-west', wall: 'mar-west-e-s', facing: 'west', count: 2, presetOffset: 0 },
  { roomId: 'mar-west', wall: 'mar-west-p1', facing: 'west', count: 2, presetOffset: 1 },
  { roomId: 'mar-west', wall: 'mar-west-p1', facing: 'east', count: 2, presetOffset: 2 },

  { roomId: 'mar-east', wall: 'mar-east-n', facing: 'south', count: 4, presetOffset: 1 },
  { roomId: 'mar-east', wall: 'mar-east-s', facing: 'north', count: 3, presetOffset: 0 },
  { roomId: 'mar-east', wall: 'mar-east-e', facing: 'west', count: 2, presetOffset: 2 },
  { roomId: 'mar-east', wall: 'mar-hall-e-n', facing: 'east', count: 1, presetOffset: 0, span: [-17.6, -13.75] },
  { roomId: 'mar-east', wall: 'mar-east-p1', facing: 'north', count: 2, presetOffset: 1 },
  { roomId: 'mar-east', wall: 'mar-east-p1', facing: 'south', count: 2, presetOffset: 2 },

  { roomId: 'mar-hall', wall: 'mar-hall-n-w', facing: 'south', count: 3, presetOffset: 0 },
  { roomId: 'mar-hall', wall: 'mar-hall-n-e', facing: 'south', count: 4, presetOffset: 1 },
]

export const marGallerySlots: GallerySlot[] = MAR_HANGINGS.flatMap((hanging) => hang(hanging, marWalls))
