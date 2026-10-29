import {
  clubGalleryTemplates,
  walls,
  type ClubGalleryTemplateId,
  type WallSegment,
} from '@/components/gallery/world/roomsData'

export const GALLERY_FRAME_STYLES = ['standard', 'wood', 'gold', 'black-mat', 'pinned'] as const
export type GalleryFrameStyle = (typeof GALLERY_FRAME_STYLES)[number]

export type Artwork = {
  id: string
  title: string
  artist: string
  countryCode: string
  /** The country's flag as SVG markup, or null for an unknown code. */
  flagSvg: string | null
  year: number
  image: string
  description: string
  roomId: string
  position: [number, number, number]
  rotation: [number, number, number]
  width: number
  height: number
  /** Club galleries may override the room's default mounting per obra. */
  frameStyle?: GalleryFrameStyle
  /** A Club member's way to be asked about the obra: their WhatsApp and/or a web address. */
  contact?: { whatsapp?: string; url?: string }
}

/** Where an obra can hang — content-agnostic, filled in from real data at request time. */
export type GallerySlot = {
  roomId: string
  position: [number, number, number]
  rotation: [number, number, number]
  width: number
  height: number
}

// Cycled per slot so neighboring pieces don't all read the same size —
// the real image still keeps its own aspect ratio inside this box (see
// Artwork.tsx's contain-fit).
const SIZE_PRESETS: Array<[number, number]> = [
  [2.2, 1.5],
  [1.5, 2.1],
  [1.9, 1.9],
]

const BASE_Y = 1.85

/** The way a hung obra looks out from its wall; north is -z, east is +x. */
type Facing = 'north' | 'south' | 'east' | 'west'

const FACING_ROTATION: Record<Facing, number> = {
  south: 0,
  north: Math.PI,
  east: Math.PI / 2,
  west: -Math.PI / 2,
}

/** A row of obras on one face of a wall or panel from roomsData. */
export type Hanging = {
  roomId: string
  wall: string
  facing: Facing
  count: number
  presetOffset: number
  /** Only this stretch along the wall; the whole wall by default. */
  span?: [number, number]
}

// The slot positions come from the wall itself, so moving a wall or a panel
// in roomsData moves its obras with it.
export function hang(
  { roomId, wall: wallId, facing, count, presetOffset, span }: Hanging,
  layoutWalls: WallSegment[] = walls,
): GallerySlot[] {
  const wall = layoutWalls.find((candidate) => candidate.id === wallId)
  if (!wall) throw new Error(`Unknown wall ${wallId}`)
  const runsAlongX = wall.size[0] > wall.size[2]
  if (runsAlongX !== (facing === 'north' || facing === 'south')) throw new Error(`${wallId} has no ${facing} face`)
  const along = runsAlongX ? 0 : 2
  const across = runsAlongX ? 2 : 0
  const [from, to] = span ?? [wall.position[along] - wall.size[along] / 2, wall.position[along] + wall.size[along] / 2]
  const face = wall.position[across] + (facing === 'south' || facing === 'east' ? 1 : -1) * (wall.size[across] / 2)

  const sizes = Array.from(
    { length: count },
    (_, i) => SIZE_PRESETS[(presetOffset + i) % SIZE_PRESETS.length],
  )
  const occupiedWidth = sizes.reduce((total, [width]) => total + width, 0)
  // Divide every bit of empty wall into equal gaps, including the space at
  // both ends. Using the frame widths (rather than equally spaced centers)
  // keeps mixed portrait/landscape presets visually equidistant.
  const gap = (to - from - occupiedWidth) / (count + 1)
  let cursor = from + gap

  return sizes.map(([width, height]) => {
    const center = cursor + width / 2
    cursor += width + gap
    return {
      roomId,
      position: runsAlongX ? [center, BASE_Y, face] : [face, BASE_Y, center],
      rotation: [0, FACING_ROTATION[facing], 0],
      width,
      height,
    }
  })
}

// 37 spots (9 / 14 / 14 per room), the number ensure_exhibition_today fills
// each day, hung at an even density: about a metre of bare wall between
// frames everywhere. Room 1's west wall is the collective collage
// (components/gallery/wall), so it hangs on its long walls, both faces of
// its panel and the small cabinet the panel closes off by the door. The
// hall, the widest room, takes the most, on every wall. Room 3 hangs one per
// face around its bays, one on your right as you come in, and three on its
// end wall. Blank stretches are left
// on purpose where a frame would crowd a doorway or a panel's end.
export const HANGINGS: Hanging[] = [
  { roomId: 'room-01', wall: 'r1-north', facing: 'south', count: 3, presetOffset: 0 },
  { roomId: 'room-01', wall: 'r1-south', facing: 'north', count: 2, presetOffset: 1, span: [-17.9, -11.6] },
  { roomId: 'room-01', wall: 'panel-1', facing: 'west', count: 1, presetOffset: 1 },
  // The cabinet between the panel and the doorway.
  { roomId: 'room-01', wall: 'panel-1', facing: 'east', count: 1, presetOffset: 1 },
  { roomId: 'room-01', wall: 'r1-south', facing: 'north', count: 1, presetOffset: 1, span: [-11.4, -8.1] },
  { roomId: 'room-01', wall: 'div-1-2-b', facing: 'west', count: 1, presetOffset: 2, span: [0, 4.9] },

  { roomId: 'room-02', wall: 'r2-north', facing: 'south', count: 4, presetOffset: 0 },
  { roomId: 'room-02', wall: 'r2-south', facing: 'north', count: 4, presetOffset: 1 },
  { roomId: 'room-02', wall: 'panel-2', facing: 'north', count: 1, presetOffset: 2 },
  { roomId: 'room-02', wall: 'panel-2', facing: 'south', count: 1, presetOffset: 0 },
  { roomId: 'room-02', wall: 'div-1-2-b', facing: 'east', count: 2, presetOffset: 1 },
  { roomId: 'room-02', wall: 'div-2-3-a', facing: 'west', count: 2, presetOffset: 1 },

  { roomId: 'room-03', wall: 'div-2-3-a', facing: 'east', count: 2, presetOffset: 1 },
  { roomId: 'room-03', wall: 'r3-north', facing: 'south', count: 1, presetOffset: 2, span: [6.1, 10.4] },
  { roomId: 'room-03', wall: 'r3-south', facing: 'north', count: 1, presetOffset: 1, span: [6.6, 10] },
  { roomId: 'room-03', wall: 'panel-3a', facing: 'west', count: 1, presetOffset: 0 },
  { roomId: 'room-03', wall: 'panel-3a', facing: 'east', count: 1, presetOffset: 1 },
  { roomId: 'room-03', wall: 'r3-north', facing: 'south', count: 1, presetOffset: 1, span: [10.6, 13.7] },
  { roomId: 'room-03', wall: 'r3-south', facing: 'north', count: 1, presetOffset: 2, span: [10.6, 14.4] },
  { roomId: 'room-03', wall: 'panel-3b', facing: 'west', count: 1, presetOffset: 2 },
  { roomId: 'room-03', wall: 'panel-3b', facing: 'east', count: 1, presetOffset: 0 },
  { roomId: 'room-03', wall: 'r3-south', facing: 'north', count: 1, presetOffset: 1, span: [14.6, 17.9] },
  { roomId: 'room-03', wall: 'r3-east', facing: 'west', count: 3, presetOffset: 1 },
]

export const gallerySlots: GallerySlot[] = HANGINGS.flatMap((hanging) => hang(hanging))

export const CLUB_HANGINGS: Record<ClubGalleryTemplateId, Hanging[]> = {
  cabinet: [
    { roomId: 'club-room-01', wall: 'cabinet-north', facing: 'south', count: 3, presetOffset: 0 },
    { roomId: 'club-room-01', wall: 'cabinet-south-west', facing: 'north', count: 1, presetOffset: 1 },
    { roomId: 'club-room-01', wall: 'cabinet-south-east', facing: 'north', count: 1, presetOffset: 2 },
    { roomId: 'club-room-01', wall: 'cabinet-west', facing: 'east', count: 2, presetOffset: 1 },
    { roomId: 'club-room-01', wall: 'cabinet-east', facing: 'west', count: 1, presetOffset: 2 },
  ],
  classic: [
    { roomId: 'club-room-01', wall: 'classic-north', facing: 'south', count: 4, presetOffset: 0 },
    { roomId: 'club-room-01', wall: 'classic-west', facing: 'east', count: 3, presetOffset: 1 },
    { roomId: 'club-room-01', wall: 'classic-east', facing: 'west', count: 3, presetOffset: 2 },
    { roomId: 'club-room-01', wall: 'classic-panel', facing: 'west', count: 2, presetOffset: 0 },
    { roomId: 'club-room-01', wall: 'classic-panel', facing: 'east', count: 2, presetOffset: 1 },
  ],
  double: [
    { roomId: 'club-room-01', wall: 'double-north', facing: 'south', count: 4, presetOffset: 0, span: [-11.9, -0.1] },
    { roomId: 'club-room-02', wall: 'double-north', facing: 'south', count: 4, presetOffset: 1, span: [0.1, 11.9] },
    { roomId: 'club-room-01', wall: 'double-west', facing: 'east', count: 3, presetOffset: 1 },
    { roomId: 'club-room-02', wall: 'double-east', facing: 'west', count: 3, presetOffset: 2 },
    { roomId: 'club-room-01', wall: 'double-divider-north', facing: 'west', count: 2, presetOffset: 0 },
    { roomId: 'club-room-02', wall: 'double-divider-north', facing: 'east', count: 2, presetOffset: 1 },
    { roomId: 'club-room-01', wall: 'double-panel-west', facing: 'west', count: 1, presetOffset: 2 },
    { roomId: 'club-room-01', wall: 'double-panel-west', facing: 'east', count: 1, presetOffset: 0 },
    { roomId: 'club-room-02', wall: 'double-panel-east', facing: 'west', count: 1, presetOffset: 1 },
    { roomId: 'club-room-02', wall: 'double-panel-east', facing: 'east', count: 1, presetOffset: 2 },
  ],
}

export const clubGallerySlots: Record<ClubGalleryTemplateId, GallerySlot[]> = Object.fromEntries(
  Object.entries(CLUB_HANGINGS).map(([templateId, hangings]) => {
    const id = templateId as ClubGalleryTemplateId
    return [id, hangings.flatMap((hanging) => hang(hanging, clubGalleryTemplates[id].walls))]
  }),
) as Record<ClubGalleryTemplateId, GallerySlot[]>
