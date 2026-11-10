// Provisional geometry for Museo MAR (Mar del Plata). Every metre here is an
// estimate: the plan and sections establish the arrangement, not a survey.
// What was read off the sheets versus what was guessed is written up in
// docs/mar-gallery.md. Change a number here and the mesh, the collider, the
// walk map and the hanging spots move together.

import { hang, type GallerySlot, type Hanging } from '@/data/artworks'
import type { GalleryRoomTemplate, WallSegment } from '../roomsData'

export type MarKind =
  | 'concrete'
  | 'deck'
  | 'white'
  | 'glass'
  | 'darkglass'
  | 'interior'
  | 'mullion'
  | 'steel'
  | 'black'
  | 'board'
  | 'louvre'
  | 'blueglass'
  | 'platform'
  | 'granite'
  | 'void'
  | 'seat'
  | 'table'
  | 'curb'
  | 'trunk'
  | 'distant'

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
  /** False hides a walk-map-only box (the escalator lane). */
  visual?: boolean
  freestanding?: true
}

/** Metres. All of these are provisional — see docs/mar-gallery.md. */
export const MAR = {
  /** Facade panel module. The joints are visible; their spacing is not dimensioned on the sheets. */
  panel: { width: 2.4, height: 1.2 },
  /** One repeat of the plaza's fan paving (setts are 0.1 m). */
  cobble: 3,
  wall: 0.28,
  /** Clear height of the central doors. The photos show a full-height glass wall with a door bank under a head. */
  doorHeight: 3.2,
  /** Double-height hall, floor to ceiling. The mezzanine sits about halfway up in the interior photo. */
  hallHeight: 9,
  /** Walk surface of the upper floor: the mezzanine round the hall's void and the gallery beside it. */
  mezzanine: 5.2,
  /** Ceiling of the café and the shop, under the upper floor's slab. */
  westInterior: 4.9,
  /** Left volume, the tallest, with an upper window band on the cantilever. */
  westExterior: 16,
  eastInterior: 5.6,
  /** Right volume, the one with the printed vinyl at its foot. */
  eastExterior: 11,
  /** Volume over the door bank, the one carrying the Buenos Aires Provincia mark. */
  logoExterior: 13.4,
  /** The tall end volume, with the vent housing and the stair at its foot. */
  towerExterior: 16,
  /** Underside of the slab over the doors. */
  soffit: 4.6,
  /** Door head: swing leaves and the revolving drum stop here, glass transoms run above. */
  doorLeaf: 2.6,
  auditorium: 7.4,
  /** How thick a temporary exhibition partition reads. */
  partition: 0.12,
  partitionHeight: 3.05,
  /** The black wall of the Laboratorio, taller than the white fit-out partitions. */
  labHeight: 4.2,
} as const

const T = MAR.wall

/** The sea lion sculpture's platform on the plaza, in front of the vinyl-faced volume. */
export const LOBO = { x0: 7.6, x1: 21.8, z0: 8.4, z1: 14.8, height: 0.35, /** Where the sculpture's head stands, on the slab. */ head: { x: 10.8, z: 11.6 } } as const

/** The shop in the west room (Tienda FIND): footprint of its fascia. */
export const SHOP = { x0: -19.4, x1: -15, z0: 2.7, z1: 7.7 } as const
/** Café tables in the west room, centres on the floor. */
export const CAFE_TABLES: Array<[number, number]> = [[-25.8, 4.1], [-22.9, 4.1], [-25.8, 6.5], [-22.9, 6.5]]
/** The sunken stair beside the vent housing: a hole in the paving, walled off. */
export const STAIR = { x0: 20, x1: 22.6, z0: 3.4, z1: 7.6, depth: 2.7 } as const

/**
 * The gallery on the upper floor, entered from the mezzanine through the hall's west wall: a 30 × 30 m room
 * that spreads over the café and out past it to the west and north (the volume grows to hold it), white
 * walls, light strips in the roof, and five partitions so the day's obras hang with room to spare. The
 * photograph of its entrance is all there is; the room itself is an invention to the size given.
 */
export const GALLERY = {
  /** Clear interior, metres. */
  x0: -42.18,
  x1: -12.18,
  z0: -22,
  z1: 8,
  /** Clear height, floor to the underside of the roof. */
  height: 6,
  /** Height of the underside of the roof above the world's floor (the upper floor's 5.2 m plus the clear height). */
  top: 5.2 + 6,
  /** Thickness of the white lining; the concrete skin is another MAR.wall outside it. */
  lining: 0.24,
  /** The opening in the hall's west wall, which the room's east wall is. */
  door: { z0: -11.4, z1: -8.4, height: 3.6 },
  /** x of each freestanding partition; they run z0..z1, leaving three metres at either end to walk round and five between. */
  partitions: { xs: [-37.2, -32.2, -27.2, -22.2, -17.2], z0: -19, z1: 5, height: 3.4 },
  /** Frame sizes in here, [width, height]: the main gallery's. */
  sizes: [[2.2, 1.5], [1.5, 2.1], [1.9, 1.9]] as Array<[number, number]>,
} as const

const GX0 = GALLERY.x0
const GZ0 = GALLERY.z0
const GZ1 = GALLERY.z1
const L = GALLERY.lining

/**
 * Printed banners on the facade. Each is a rectangle on a wall; \`image\` is the
 * picture on it. Without one the slot shows a stand-in drawn in decals.ts.
 * To change a banner, set \`image\` to a path under /public (or an https URL).
 */
export type MarBanner = {
  id: string
  /** Centre of the print, metres. It faces +Z, toward the plaza, unless \`yaw\` turns it. */
  center: [number, number, number]
  /** Turn about the vertical, radians. 0 faces +Z; Math.PI / 2 faces +X. */
  yaw?: number
  /** A roll-up banner on its own stand, printed on both sides, rather than a print on a wall. */
  standee?: boolean
  width: number
  height: number
  /** Picture to print. Leave unset for the stand-in. */
  image?: string
}

export const MAR_BANNERS: MarBanner[] = [
  // On the glass left of the revolving door.
  { id: 'door-a', center: [-10.3, 1.9, 0.08], width: 1.8, height: 3.3 },
  { id: 'door-b', center: [-8.8, 1.9, 0.08], width: 1.2, height: 3.3 },
  { id: 'door-c', center: [-7.3, 1.85, 0.08], width: 1.7, height: 3.2 },
  // The long vinyl at the foot of the volume right of the slot.
  { id: 'vinyl', center: [14.15, 1.78, 2.02], width: 11.1, height: 2.8 },
  // Roll-up banners in the hall, either side of the door as you come in.
  { id: 'standee-a', center: [-8.3, 1.05, -3.4], width: 0.85, height: 2, standee: true },
  { id: 'standee-b', center: [-7.2, 1.05, -3.4], width: 0.85, height: 2, standee: true },
  // At the foot of the gallery's portal, on the mezzanine, turned to face the escalators.
  { id: 'standee-c', center: [-10.4, MAR.mezzanine + 1.05, -12.5], width: 0.85, height: 2, standee: true, yaw: Math.PI / 2 },
]

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
  extra: Partial<Pick<MarBox, 'path' | 'solid' | 'visual' | 'freestanding'>> = {},
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

const seeThrough = { path: false as const, solid: false as const }

/** Dark frames on a run of glass along X. Not colliders: the glass wall already stops the walk. */
function mullionsX(id: string, x0: number, x1: number, z: number, y0: number, y1: number, spacing = 1.2): MarBox[] {
  const bars: MarBox[] = [
    box(`${id}-top`, x0, y1 - 0.06, z - 0.05, x1, y1, z + 0.05, 'mullion', seeThrough),
  ]
  let i = 0
  for (let x = x0; x <= x1 + 0.01; x += spacing) {
    bars.push(box(`${id}-${i++}`, x - 0.028, y0, z - 0.04, x + 0.028, y1, z + 0.04, 'mullion', seeThrough))
  }
  return bars
}

function mullionsZ(id: string, z0: number, z1: number, x: number, y0: number, y1: number, spacing = 1.2): MarBox[] {
  const bars: MarBox[] = [
    box(`${id}-top`, x - 0.05, y1 - 0.06, z0, x + 0.05, y1, z1, 'mullion', seeThrough),
  ]
  let i = 0
  for (let z = z0; z <= z1 + 0.01; z += spacing) {
    bars.push(box(`${id}-${i++}`, x - 0.04, y0, z - 0.028, x + 0.04, y1, z + 0.028, 'mullion', seeThrough))
  }
  return bars
}

/** Dark frame posts on a glass wall along X, at explicit positions. Not colliders. */
function postsX(id: string, xs: number[], z: number, y0: number, y1: number, width = 0.07): MarBox[] {
  return xs.map((x, index) => box(`${id}-${index}`, x - width / 2, y0, z - 0.05, x + width / 2, y1, z + 0.05, 'mullion', seeThrough))
}

/** A horizontal frame bar along X. */
function barX(id: string, x0: number, x1: number, z: number, y: number, kind: MarKind = 'mullion', height = 0.1): MarBox {
  return box(id, x0, y - height / 2, z - 0.05, x1, y + height / 2, z + 0.05, kind, seeThrough)
}

/** A swing door leaf standing open, hinged at a jamb and pushed into the hall. Glass in a steel frame; nothing to collide with. */
function openLeaf(id: string, x: number, z0: number, z1: number): MarBox[] {
  const t = 0.04
  return [
    box(`${id}-glass`, x - 0.015, 0.1, z0, x + 0.015, MAR.doorLeaf - 0.08, z1, 'glass', seeThrough),
    box(`${id}-stile-a`, x - t, 0.1, z0, x + t, MAR.doorLeaf - 0.04, z0 + 0.09, 'steel', seeThrough),
    box(`${id}-stile-b`, x - t, 0.1, z1 - 0.09, x + t, MAR.doorLeaf - 0.04, z1, 'steel', seeThrough),
    box(`${id}-head`, x - t, MAR.doorLeaf - 0.12, z0, x + t, MAR.doorLeaf - 0.04, z1, 'steel', seeThrough),
    box(`${id}-foot`, x - t, 0.1, z0, x + t, 0.3, z1, 'steel', seeThrough),
  ]
}

const H = MAR.hallHeight
const U = MAR.mezzanine

/** A box standing on the upper floor, `h` metres tall. */
function up(id: string, minX: number, minZ: number, maxX: number, maxZ: number, h: number, kind: MarKind = 'white', extra: Partial<Pick<MarBox, 'path' | 'solid' | 'visual' | 'freestanding'>> = {}): MarBox {
  return box(id, minX, U, minZ, maxX, U + h, maxZ, kind, extra)
}
const WEST_H = MAR.westExterior
const EAST_H = MAR.eastExterior
const LOGO_H = MAR.logoExterior
const TOWER_H = MAR.towerExterior
const SOFFIT = MAR.soffit
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
  // The hall's west wall north of the café door. Up to the roof of the west volume, with a portal
  // into the upper gallery (the wall under it stays solid on the ground floor).
  wallZ('mar-west-e-n-a', -12, GALLERY.door.z0, MAR_DOORS.west.x, WEST_H),
  box('mar-west-e-n-low', -12.14, 0, GALLERY.door.z0, -11.86, U, GALLERY.door.z1, 'concrete'),
  box('mar-west-e-n-head', -12.14, U + GALLERY.door.height, GALLERY.door.z0, -11.86, WEST_H, GALLERY.door.z1, 'concrete'),
  wallZ('mar-west-e-n-b', GALLERY.door.z1, MAR_DOORS.west.z0, MAR_DOORS.west.x, WEST_H),
  wallZ('mar-west-e-s', MAR_DOORS.west.z1, 8, MAR_DOORS.west.x, WEST_H),
  wallZ('mar-hall-e-n', -20, MAR_DOORS.east.z0, MAR_DOORS.east.x, H),
  wallZ('mar-hall-e-s', MAR_DOORS.east.z1, -7.8, MAR_DOORS.east.x, H),
  wallZ('mar-hall-e-pier', -0.2, 0, 14, H),

  // West exhibition volume (the café). Ground floor glazed to the plaza, tucked under the upper floor.
  // The café's own walls stop at the gallery's floor; above them the gallery's skin is the volume.
  wallZ('mar-west-w', -12, 8, -30, U - 0.25),
  wallX('mar-west-n', -30, -12, -12, U - 0.25),
  wallX('mar-west-s-glass', -30, -12, 8, SOFFIT, 'glass'),
  box('mar-west-s-up', -30, SOFFIT, 8 - T / 2, -12, WEST_H, 8 + T / 2, 'concrete'),
  // The upper floor overhangs the plaza: a thick slab edge, a recessed window band, then blank concrete.
  // All above head height, so the plaza stays open under it.
  box('mar-west-lip', -26, SOFFIT, 8, -7, 5.9, 12.35, 'concrete'),
  box('mar-west-win-back', -26, 5.9, 8, -7, 8.3, 11.95, 'interior'),
  box('mar-west-cantilever', -26, 8.3, 8, -7, WEST_H, 12.2, 'concrete'),
  box('mar-west-win-glass', -25.6, 5.95, 11.96, -7.4, 8.25, 12.0, 'glass', seeThrough),
  ...mullionsX('mar-west-win-mullion', -25.6, -7.4, 12.04, 5.95, 8.25, 2.27),

  // East exhibition room.
  wallX('mar-east-n', 14, 32, -18, EAST_H),
  wallX('mar-east-s', 14, 32, -8, EAST_H),
  wallZ('mar-east-e', -18, -8, 32, EAST_H),

  // The volume right of the glass slot. Its ground floor is set back behind printed vinyl; the upper
  // floors overhang it. A tall narrow window runs up its east end.
  box('mar-banner-low', 7.2, 0, 0.15, 20, 3.6, 2.0, 'concrete'),
  box('mar-banner-up', 7.2, 3.6, 0.15, 20, EAST_H, 3.4, 'concrete'),
  box('mar-banner-slit', 18.6, 4.7, 3.4, 19.6, 10, 3.45, 'darkglass', seeThrough),
  ...postsX('mar-banner-slit-frame', [18.55, 19.65], 3.46, 4.7, 10, 0.1),

  // The tall end volume. A black door at its foot, a ground window, and in front of both
  // the housing that vents the level below, with the stair going down beside it.
  box('mar-tower', 20, 0, 0.15, 34, TOWER_H, 3.4, 'concrete'),
  box('mar-tower-door', 23.8, 0, 3.4, 26.6, 3.7, 3.44, 'void', seeThrough),
  box('mar-tower-window', 29.2, 0.3, 3.4, 32.8, 3.4, 3.44, 'darkglass', seeThrough),
  ...mullionsX('mar-tower-mullion', 29.2, 32.8, 3.47, 0.3, 3.4, 1.2),
  box('mar-vent-plinth', 22.6, 0, 3.4, 33, 1.15, 7.6, 'concrete'),
  wallZ('mar-stair-wall', 3.4, 7.6, 19.85, 1, 'concrete', 0.3),
  box('mar-stair-block', 20, 0, 3.4, 22.6, 1.2, 7.6, 'void', { visual: false }),

  // The sea lion's platform: a low slab with a rail round it. The sculpture itself is drawn
  // in SeaLion.tsx; this keeps people out of it.
  box('mar-lobo-slab', LOBO.x0, 0, LOBO.z0, LOBO.x1, LOBO.height, LOBO.z1, 'platform', seeThrough),
  box('mar-lobo-block', LOBO.x0, 0, LOBO.z0, LOBO.x1, 1.2, LOBO.z1, 'platform', { visual: false }),

  // A street lamp's concrete column on each side of the plaza.
  box('mar-lamp-w', -34.25, 0, 20.75, -33.75, 13, 21.25, 'concrete', seeThrough),
  box('mar-lamp-e', 36.75, 0, 18.75, 37.25, 13, 19.25, 'concrete', seeThrough),
  // The step across the plaza, a long granite kerb. Drawn flat: the ground is one slab.
  box('mar-plaza-step', -48, 0, 19.6, 40, 0.1, 19.95, 'granite', seeThrough),

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

  // The front of the hall, from the plaza. Left to right: a slice of concrete, the volume over the doors
  // (slab, a recessed window band, blank concrete above), the door bank under its soffit, a tall glass slot
  // with concrete above, then the vinyl-faced volume. Glass walls here are the real stop; frames are just drawn.
  wallX('mar-hall-s-concrete-w', -12, -11.4, 0, LOGO_H),
  box('mar-logo-slab', -11.4, SOFFIT, 0, 4.2, 5.8, 3.4, 'concrete'),
  box('mar-logo-win-back', -11.4, 5.8, 0, 4.2, 8, 2.95, 'interior'),
  box('mar-logo-up', -11.4, 8, 0, 4.2, LOGO_H, 3.2, 'concrete'),
  box('mar-logo-win-glass', -11, 5.85, 2.96, 3.8, 7.95, 3, 'glass', seeThrough),
  ...mullionsX('mar-logo-win-mullion', -11, 3.8, 3.05, 5.85, 7.95, 1.95),
  wallX('mar-hall-s-glass-w1', -11.4, -5.25, 0, MAR.doorLeaf, 'glass', 0.08),
  wallX('mar-hall-s-glass-w2', -5.25, MAR_DOORS.entrance.x0, 0, MAR.doorLeaf, 'glass', 0.08),
  wallX('mar-hall-s-glass-e', MAR_DOORS.entrance.x1, 4.2, 0, MAR.doorLeaf, 'glass', 0.08),
  box('mar-hall-s-transom', -11.4, MAR.doorLeaf, -0.04, 4.2, SOFFIT, 0.04, 'glass', seeThrough),
  // The revolving door's drum (drawn in Facade.tsx). It blocks the way; the swing doors beside it are the way in.
  box('mar-revolve', -5.25, 0, -0.35, -2.75, MAR.doorLeaf + 0.1, 2.15, 'glass', { visual: false }),
  barX('mar-frame-head', -11.4, 4.2, 0.06, MAR.doorLeaf),
  barX('mar-frame-mid', -11.4, 4.2, 0.06, 3.6, 'mullion', 0.07),
  barX('mar-frame-top', -11.4, 4.2, 0.06, SOFFIT - 0.05, 'mullion', 0.1),
  ...postsX('mar-frame-post', [-11.4, -9.4, -8.15, -6.45, -5.25, -2.75, MAR_DOORS.entrance.x0, MAR_DOORS.entrance.x1, 4.2], 0.06, 0, MAR.doorLeaf, 0.08),
  ...postsX('mar-frame-transom-post', [-9.8, -8.1, -6.4, -4.7, -3.1, -1.5, 0, 1.5, 3, 4.2], 0.06, MAR.doorLeaf, SOFFIT, 0.06),
  ...openLeaf('mar-leaf-w', MAR_DOORS.entrance.x0 - 0.04, -1.4, -0.06),
  ...openLeaf('mar-leaf-e', MAR_DOORS.entrance.x1 + 0.04, -1.4, -0.06),
  // The glass slot: full height, with a cap of concrete over it.
  box('mar-slot-glass', 4.2, 0, -0.04, 7.2, H, 0.04, 'glass'),
  box('mar-slot-cap', 4.2, H, -T / 2, 7.2, LOGO_H, T / 2, 'concrete'),
  ...mullionsX('mar-slot-mullion', 4.2, 7.2, 0.06, 0, H, 1.5),
  barX('mar-slot-bar-a', 4.2, 7.2, 0.06, 3.6, 'mullion', 0.08),
  barX('mar-slot-bar-b', 4.2, 7.2, 0.06, 6.6, 'mullion', 0.08),
  // East window of the hall, toward the trees. A sill, not a door.
  box('mar-hall-window-e', 14 - 0.04, 0.35, -7.8, 14 + 0.04, 8.2, -0.2, 'glass'),
  ...mullionsX('mar-mullion-door-w', -4.2, MAR_DOORS.entrance.x0, 0.06, 0, H, 1.15),
  ...mullionsX('mar-mullion-door-e', MAR_DOORS.entrance.x1, 4.4, 0.06, 0, H, 1.15),
  ...mullionsX('mar-mullion-transom', MAR_DOORS.entrance.x0, MAR_DOORS.entrance.x1, 0.06, MAR.doorHeight, H, 1.3),
  ...mullionsX('mar-mullion-west-glass', -30, -12, 8.08, 0, SOFFIT, 1.25),
  ...mullionsZ('mar-mullion-hall-e', -7.8, -0.2, 14.08, 0.35, 8.2, 1.25),

  // --- Ground floor dressing, from the interior photographs. Everything here keeps clear of the
  // strips in front of hung walls (about 2.5 m), so every obra can still be walked up to.
  // Over the door to the west room: a louvred band under the concrete.
  box('mar-west-louvre', -12.14, 3.4, -3.45, -11.86, 4.7, -0.35, 'louvre', seeThrough),
  box('mar-west-lintel', -12.14, 4.7, -3.45, -11.86, WEST_H, -0.35, 'concrete', seeThrough),
  // The blue glass box in the hall's west corner, and the reception counter beside it.
  box('mar-blue-box', -11.8, 0, -9.4, -9.6, 4.2, -6.8, 'blueglass'),
  box('mar-reception', -11.7, 0, -5.9, -9.7, 1.1, -4, 'black'),
  // A marble-topped table in front of the poster glass; visual only, its legs are drawn in Interior.tsx.
  box('mar-hall-table', -8.9, 0, -2.3, -6.5, 0.8, -1.4, 'table', { visual: false }),
  // The shop: a fascia hung from the ceiling, a black counter on two sides and a board-formed backdrop.
  box('mar-shop-counter-w', SHOP.x0, 0, SHOP.z0 + 0.3, SHOP.x0 + 0.7, 1.1, SHOP.z1 - 0.3, 'black'),
  box('mar-shop-counter-n', SHOP.x0, 0, SHOP.z0 + 0.3, SHOP.x1 - 0.2, 1.1, SHOP.z0 + 1, 'black'),
  box('mar-shop-backdrop', SHOP.x1 - 0.2, 0, SHOP.z0 + 1, SHOP.x1, 3.4, SHOP.z1 - 0.3, 'board'),
  box('mar-shop-fascia-n', SHOP.x0 - 0.2, 3, SHOP.z0, SHOP.x1 + 0.1, 4.3, SHOP.z0 + 0.1, 'black', seeThrough),
  box('mar-shop-fascia-w', SHOP.x0 - 0.2, 3, SHOP.z0, SHOP.x0 - 0.1, 4.3, SHOP.z1, 'black', seeThrough),
  // Café: a table's footprint each; the chairs are drawn but not collidable.
  ...CAFE_TABLES.map(([x, z], index) => box(`mar-cafe-table-${index}`, x - 0.65, 0, z - 0.4, x + 0.65, 0.76, z + 0.4, 'table', { visual: false })),
  // La Isla, the children's corner at the glass: a carpet and a bench, kept off the wall's viewing strip.
  box('mar-isla-bench', -29.4, 0, 5.7, -27.2, 0.32, 6.1, 'seat', { visual: false }),

  // --- The upper gallery: a 30 × 30 m room over the café and the new volume to its west and north, entered
  // through the portal in the hall's west wall. Solid concrete under the parts that stick out past the café,
  // a floor slab, white lining inside a concrete skin, a roof with light strips (drawn in Interior.tsx), five
  // partitions (their obras: MAR_HANGINGS).
  box('mar-portal-sill', -12.14, U - 0.25, GALLERY.door.z0, -11.86, U, GALLERY.door.z1, 'deck'),
  box('mar-ext-base-w', GX0 - L - T, 0, GZ0 - L - T, -30.14, U - 0.25, GZ1 + L + T, 'concrete'),
  box('mar-ext-base-n', -30.14, 0, GZ0 - L - T, -12.14, U - 0.25, -12.14, 'concrete'),
  box('mar-gal-floor', GX0 - L, U - 0.25, GZ0 - L, -12.14, U, GZ1 + L, 'deck'),
  up('mar-gal-w', GX0 - L, GZ0, GX0, GZ1, GALLERY.height),
  up('mar-gal-n', GX0 - L, GZ0 - L, GALLERY.x1, GZ0, GALLERY.height),
  up('mar-gal-s', GX0 - L, GZ1, -12.14, GZ1 + L, GALLERY.height),
  up('mar-gal-e-n', GALLERY.x1, GZ0, -12.14, GALLERY.door.z0, GALLERY.height),
  up('mar-gal-e-s', GALLERY.x1, GALLERY.door.z1, -12.14, GZ1, GALLERY.height),
  box('mar-gal-e-head', GALLERY.x1, U + GALLERY.door.height, GALLERY.door.z0, -12.14, GALLERY.top, GALLERY.door.z1, 'white'),
  ...GALLERY.partitions.xs.map((x, index) => up(`mar-gal-p${index + 1}`, x - 0.06, GALLERY.partitions.z0, x + 0.06, GALLERY.partitions.z1, GALLERY.partitions.height)),
  // Concrete skin outside the lining, from the slab to the top of the volume; the roof slab; a solid block above it.
  box('mar-gal-skin-w', GX0 - L - T, U - 0.25, GZ0 - L - T, GX0 - L, WEST_H, GZ1 + L + T, 'concrete'),
  box('mar-gal-skin-n', GX0 - L, U - 0.25, GZ0 - L - T, -12.14, WEST_H, GZ0 - L, 'concrete'),
  box('mar-gal-skin-s', GX0 - L, U - 0.25, GZ1 + L, -30, WEST_H, GZ1 + L + T, 'concrete'),
  box('mar-gal-skin-e', -12.14, H, GZ0 - L - T, -11.86, WEST_H, -12, 'concrete'),
  box('mar-gal-skin-e-n', -12.14, 0, GZ0 - L - T, -11.86, WEST_H, -20, 'concrete'),
  box('mar-gal-roof', GX0 - L, GALLERY.top, GZ0 - L, -12.14, GALLERY.top + 0.3, GZ1 + L, 'white'),
  box('mar-gal-top', GX0 - L - T, GALLERY.top + 0.3, GZ0 - L - T, -11.86, WEST_H, GZ1 + L + T, 'concrete'),
  // The lounge on the landing: two display cases and two white leather chairs. Drawn in Interior.tsx.
  up('mar-vitrine-a', 8.1, -16.7, 10.5, -15.5, 0.95, 'table', { visual: false }),
  up('mar-vitrine-b', 11.6, -13.4, 13.6, -12.3, 0.95, 'table', { visual: false }),
  up('mar-chair-a', 11.6, -10.9, 12.5, -10, 0.8, 'table', { visual: false }),
  up('mar-chair-b', 12.8, -11.1, 13.6, -10.2, 0.8, 'table', { visual: false }),

  // Temporary white partitions. They are a typical exhibition fit-out, not a copy of a particular show.
  wallZ('mar-west-p1', -7, 2, -21, MAR.labHeight, 'black', 0.16),
  wallX('mar-east-p1', 20, 28.5, -13, MAR.partitionHeight, 'white', MAR.partition),

  // Mezzanine deck and glass balustrade around the void. Above the walk, so the ground floor stays open.
  box('mar-bridge', -11.86, MAR.mezzanine - 0.25, -13.2, 6.5, MAR.mezzanine, -8.2, 'deck'),
  box('mar-landing', 6.5, MAR.mezzanine - 0.25, -17.5, 13.86, MAR.mezzanine, -8.2, 'deck'),
  box('mar-rail-bridge-n', -11.86, MAR.mezzanine, -13.28, 6.5, MAR.mezzanine + 1.1, -13.16, 'glass'),
  box('mar-rail-bridge-s', -11.86, MAR.mezzanine, -8.28, 6.5, MAR.mezzanine + 1.1, -8.16, 'glass'),
  box('mar-rail-land-w', 6.46, MAR.mezzanine, -17.5, 6.58, MAR.mezzanine + 1.1, -13.2, 'glass'),
  box('mar-rail-land-n', 6.5, MAR.mezzanine, -17.58, 13.86, MAR.mezzanine + 1.1, -17.46, 'glass'),
  box('mar-rail-land-s-w', 6.5, MAR.mezzanine, -8.28, 7.25, MAR.mezzanine + 1.1, -8.16, 'glass'),
  box('mar-rail-land-s-e', 10.8, MAR.mezzanine, -8.28, 13.86, MAR.mezzanine + 1.1, -8.16, 'glass'),

  // Escalator side rails. The lanes themselves are open so you can walk on.
  box('mar-esc-rail-w', 7.15, 0, -7.5, 7.4, 1.15, -1.7, 'concrete', { visual: false }),
  box('mar-esc-rail-m', 8.95, 0, -7.5, 9.12, 1.15, -1.7, 'concrete', { visual: false }),
  box('mar-esc-rail-e', 10.65, 0, -7.5, 10.9, 1.15, -1.7, 'concrete', { visual: false }),
  // Click-to-walk goes around the lanes; walking onto them still climbs.
  box('mar-esc-lane', 7.15, 0, -8.25, 10.9, 1.2, -1.7, 'concrete', { path: true, solid: false, visual: false }),

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

  // Low houses beyond the grass, as in the side-facade photo. Outside the curb, not part of the museum.
  box('mar-house-a', -10, 0, 34.2, 1.5, 3.1, 39.5, 'distant', seeThrough),
  box('mar-house-b', 6, 0, 35, 15, 4.2, 40.5, 'distant', seeThrough),
  box('mar-house-c', 20, 0, 34.4, 29, 2.5, 38.8, 'distant', seeThrough),

  // Edge of the modeled site, not a wall of the museum. Low enough to see over, high enough that a hop stays inside.
  wallX('mar-curb-s', -48, 40, 32, 0.7, 'curb', 0.4),
  wallX('mar-curb-n', -48, 40, -42, 0.7, 'curb', 0.4),
  wallZ('mar-curb-w', -42, 32, -48, 0.7, 'curb', 0.4),
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

const partitionIds = new Set(['mar-west-p1', 'mar-east-p1', 'mar-gal-p1', 'mar-gal-p2', 'mar-gal-p3'])

const asWall = (box: MarBox) => toWall(partitionIds.has(box.id) ? { ...box, freestanding: true } : box)

/** The ground floor's walls: what stops you between y = 0.35 and 1.5. */
export const marWalls: WallSegment[] = marBoxes.filter(blocksPath).map(asWall)

/** What stops you on the upper floor: whatever stands between its floor and a person's height. Ground-only things (counters, tables) fall under it. */
export function blocksPathUpstairs(box: MarBox): boolean {
  if (box.path === false) return false
  return box.maxY > U + 0.35 && box.minY < U + 1.5
}

export const marUpperWalls: WallSegment[] = marBoxes.filter(blocksPathUpstairs).map(asWall)

/** Every box as a wall segment, either floor: what a hanging can pick as its wall. */
const marSurfaces: WallSegment[] = marBoxes.map(asWall)

/** Floors are visual only. The walk surface is one slab at y = 0, so the threshold has no lip. */
export const marFloors = [
  // The paving, cut round the stair's hole.
  { id: 'cobble-front', kind: 'cobble' as const, x0: -48, x1: 40, z0: 0, z1: STAIR.z0 },
  { id: 'cobble-stair-w', kind: 'cobble' as const, x0: -48, x1: STAIR.x0, z0: STAIR.z0, z1: STAIR.z1 },
  { id: 'cobble-stair-e', kind: 'cobble' as const, x0: STAIR.x1, x1: 40, z0: STAIR.z0, z1: STAIR.z1 },
  { id: 'cobble', kind: 'cobble' as const, x0: -48, x1: 40, z0: STAIR.z1, z1: 23 },
  { id: 'grass', kind: 'grass' as const, x0: -48, x1: 40, z0: 23, z1: 32 },
  { id: 'hall', kind: 'polish' as const, x0: -11.84, x1: 13.84, z0: -19.84, z1: 0.2 },
  { id: 'west', kind: 'polish' as const, x0: -29.84, x1: -12.16, z0: -11.84, z1: 7.84 },
  { id: 'east', kind: 'dark' as const, x0: 14.16, x1: 31.84, z0: -17.84, z1: -8.16 },
  { id: 'auditorium', kind: 'auditorium' as const, x0: -7.84, x1: 15.84, z0: -37.84, z1: -20.16 },
]

const MAR_BOUNDS = [-48, -42, 40, 32] as [number, number, number, number]

export const marRooms = [
  { id: 'mar-plaza', name: 'Plaza', bounds: [-48, 0, 40, 32] as [number, number, number, number] },
  { id: 'mar-hall', name: 'Hall', bounds: [-12, -20, 14, 0] as [number, number, number, number] },
  { id: 'mar-west', name: 'Sala oeste', bounds: [-30, -12, -12, 8] as [number, number, number, number] },
  { id: 'mar-east', name: 'Sala este', bounds: [14, -18, 32, -8] as [number, number, number, number] },
  { id: 'mar-auditorium', name: 'Auditorio', bounds: [-8, -38, 16, -20] as [number, number, number, number] },
]

/** The upper floor's walk map: the mezzanine round the hall's void and the gallery, joined by the portal. */
const UPPER_FLOORS: Array<[number, number, number, number]> = [
  [-11.86, -13.2, 6.5, -8.2],
  [6.5, -17.5, 13.86, -8.2],
  [GALLERY.x0, GALLERY.z0, -12.14, GALLERY.z1],
  [-12.14, GALLERY.door.z0, -11.86, GALLERY.door.z1],
]

export const marUpperTemplate: GalleryRoomTemplate = {
  id: 'mar',
  capacity: 37,
  bounds: MAR_BOUNDS,
  rooms: [{ id: 'mar-gallery', name: 'Galería', bounds: [GALLERY.x0, GALLERY.z0, GALLERY.x1, GALLERY.z1] }],
  walls: marUpperWalls,
  floors: UPPER_FLOORS,
  doorways: [],
  garden: { flowers: [], path: [] },
}

export const marGalleryTemplate: GalleryRoomTemplate = {
  id: 'mar',
  capacity: 37,
  bounds: MAR_BOUNDS,
  rooms: marRooms,
  walls: marWalls,
  upper: {
    template: marUpperTemplate,
    height: MAR.mezzanine,
    // Up the 'up' escalator's centre line: just before its foot, and just past its head on the landing.
    link: { entry: { x: 8.175, z: -0.9 }, exit: { x: 8.175, z: -9.4 } },
  },
  doorways: [
    { id: 'mar-entrance', center: [0, 0, 0], axis: 'x' },
    { id: 'mar-west', center: [MAR_DOORS.west.x, 0, (MAR_DOORS.west.z0 + MAR_DOORS.west.z1) / 2], axis: 'z' },
    { id: 'mar-east', center: [MAR_DOORS.east.x, 0, (MAR_DOORS.east.z0 + MAR_DOORS.east.z1) / 2], axis: 'z' },
    { id: 'mar-auditorium', center: [(MAR_DOORS.auditorium.x0 + MAR_DOORS.auditorium.x1) / 2, 0, MAR_DOORS.auditorium.z], axis: 'x' },
  ],
  garden: { flowers: [], path: [] },
}

// The obras hang on the upper floor, in the 10 × 10 gallery: its four walls (the east one split by the
// portal) and three partitions, both faces. Counts sum to 37, the daily exhibition's wall count, so a full
// day still has a spot each. Same hanging helper as the Collage World Cup rooms, with the gallery's own
// frame sizes and the upper floor's height.
const upstairs = { sizes: GALLERY.sizes, baseY: U + 1.55 }
export const MAR_HANGINGS: Hanging[] = [
  // The four walls: 20 spots.
  { roomId: 'mar-gallery', wall: 'mar-gal-n', facing: 'south', count: 5, presetOffset: 0, ...upstairs },
  { roomId: 'mar-gallery', wall: 'mar-gal-w', facing: 'east', count: 5, presetOffset: 1, ...upstairs },
  { roomId: 'mar-gallery', wall: 'mar-gal-s', facing: 'north', count: 5, presetOffset: 2, ...upstairs },
  { roomId: 'mar-gallery', wall: 'mar-gal-e-n', facing: 'west', count: 2, presetOffset: 0, ...upstairs },
  { roomId: 'mar-gallery', wall: 'mar-gal-e-s', facing: 'west', count: 3, presetOffset: 1, ...upstairs },
  // Five partitions, both faces: 17 spots.
  { roomId: 'mar-gallery', wall: 'mar-gal-p1', facing: 'west', count: 2, presetOffset: 2, ...upstairs },
  { roomId: 'mar-gallery', wall: 'mar-gal-p1', facing: 'east', count: 2, presetOffset: 0, ...upstairs },
  { roomId: 'mar-gallery', wall: 'mar-gal-p2', facing: 'west', count: 2, presetOffset: 1, ...upstairs },
  { roomId: 'mar-gallery', wall: 'mar-gal-p2', facing: 'east', count: 2, presetOffset: 2, ...upstairs },
  { roomId: 'mar-gallery', wall: 'mar-gal-p3', facing: 'west', count: 2, presetOffset: 0, ...upstairs },
  { roomId: 'mar-gallery', wall: 'mar-gal-p3', facing: 'east', count: 2, presetOffset: 1, ...upstairs },
  { roomId: 'mar-gallery', wall: 'mar-gal-p4', facing: 'west', count: 1, presetOffset: 2, ...upstairs },
  { roomId: 'mar-gallery', wall: 'mar-gal-p4', facing: 'east', count: 2, presetOffset: 0, ...upstairs },
  { roomId: 'mar-gallery', wall: 'mar-gal-p5', facing: 'west', count: 1, presetOffset: 1, ...upstairs },
  { roomId: 'mar-gallery', wall: 'mar-gal-p5', facing: 'east', count: 1, presetOffset: 2, ...upstairs },
]

export const marGallerySlots: GallerySlot[] = MAR_HANGINGS.flatMap((hanging) => hang(hanging, marSurfaces))
