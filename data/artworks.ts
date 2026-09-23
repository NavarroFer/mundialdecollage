export type Artwork = {
  id: string
  title: string
  artist: string
  countryCode: string
  year: number
  image: string
  description: string
  roomId: string
  position: [number, number, number]
  rotation: [number, number, number]
  width: number
  height: number
}

/** Where an obra can hang — content-agnostic, filled in from real data at request time. */
export type GallerySlot = {
  roomId: string
  position: [number, number, number]
  rotation: [number, number, number]
  width: number
  height: number
}

const NORTH_Z = -4.9
const SOUTH_Z = 4.9
const WEST_X = -17.9
const EAST_X = 17.9
const FIRST_DIVIDER_WEST_X = -6.1
const FIRST_DIVIDER_EAST_X = -5.9
const SECOND_DIVIDER_WEST_X = 5.9
const SECOND_DIVIDER_EAST_X = 6.1
const DOOR_HALF_WIDTH = 1.2
const NORTH_ROTATION: [number, number, number] = [0, 0, 0]
const SOUTH_ROTATION: [number, number, number] = [0, Math.PI, 0]
const WEST_ROTATION: [number, number, number] = [0, Math.PI / 2, 0]
const EAST_ROTATION: [number, number, number] = [0, -Math.PI / 2, 0]

// Cycled per slot so neighboring pieces don't all read the same size —
// the real image still keeps its own aspect ratio inside this box (see
// Artwork.tsx's contain-fit).
const SIZE_PRESETS: Array<[number, number]> = [
  [2.2, 1.5],
  [1.5, 2.1],
  [1.9, 1.9],
]

function wallSlotsAlongX(
  roomId: string,
  xFrom: number,
  xTo: number,
  z: number,
  rotation: [number, number, number],
  count: number,
  presetOffset: number,
): GallerySlot[] {
  const baseY = 1.85
  const sizes = Array.from(
    { length: count },
    (_, i) => SIZE_PRESETS[(presetOffset + i) % SIZE_PRESETS.length],
  )
  const occupiedWidth = sizes.reduce((total, [width]) => total + width, 0)
  // Divide every bit of empty wall into equal gaps, including the space at
  // both ends. Using the frame widths (rather than equally spaced centers)
  // keeps mixed portrait/landscape presets visually equidistant.
  const gap = (xTo - xFrom - occupiedWidth) / (count + 1)
  let cursor = xFrom + gap

  return sizes.map(([width, height]) => {
    const x = cursor + width / 2
    cursor += width + gap
    return {
      roomId,
      position: [x, baseY, z],
      rotation,
      width,
      height,
    }
  })
}

function wallSlotsAlongZ(
  roomId: string,
  zFrom: number,
  zTo: number,
  x: number,
  rotation: [number, number, number],
  count: number,
  presetOffset: number,
): GallerySlot[] {
  return wallSlotsAlongX(roomId, zFrom, zTo, x, rotation, count, presetOffset)
    .map((slot) => ({
      ...slot,
      position: [x, slot.position[1], slot.position[0]],
    }))
}

// 20 spots distributed across every kind of usable wall (7 / 6 / 7 per
// room): the long north/south runs, both dead ends, and the transverse wall
// segments beside the doors. Door-wall pieces alternate faces so each room
// gets artwork without hanging two frames back-to-back on the same segment.
export const gallerySlots: GallerySlot[] = [
  ...wallSlotsAlongX('room-01', -18, -6, NORTH_Z, NORTH_ROTATION, 2, 0),
  ...wallSlotsAlongX('room-01', -18, -6, SOUTH_Z, SOUTH_ROTATION, 2, 2),
  ...wallSlotsAlongZ('room-01', -5, 5, WEST_X, WEST_ROTATION, 2, 1),
  ...wallSlotsAlongZ('room-01', -5, -DOOR_HALF_WIDTH, FIRST_DIVIDER_WEST_X, EAST_ROTATION, 1, 0),

  ...wallSlotsAlongX('room-02', -6, 6, NORTH_Z, NORTH_ROTATION, 2, 1),
  ...wallSlotsAlongX('room-02', -6, 6, SOUTH_Z, SOUTH_ROTATION, 2, 0),
  ...wallSlotsAlongZ('room-02', DOOR_HALF_WIDTH, 5, FIRST_DIVIDER_EAST_X, WEST_ROTATION, 1, 2),
  ...wallSlotsAlongZ('room-02', -5, -DOOR_HALF_WIDTH, SECOND_DIVIDER_WEST_X, EAST_ROTATION, 1, 1),

  ...wallSlotsAlongX('room-03', 6, 18, NORTH_Z, NORTH_ROTATION, 2, 2),
  ...wallSlotsAlongX('room-03', 6, 18, SOUTH_Z, SOUTH_ROTATION, 2, 1),
  ...wallSlotsAlongZ('room-03', -5, 5, EAST_X, EAST_ROTATION, 2, 0),
  ...wallSlotsAlongZ('room-03', DOOR_HALF_WIDTH, 5, SECOND_DIVIDER_EAST_X, WEST_ROTATION, 1, 2),
]
