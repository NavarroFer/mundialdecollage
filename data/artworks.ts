export type Artwork = {
  id: string
  title: string
  artist: string
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
const NORTH_ROTATION: [number, number, number] = [0, 0, 0]
const SOUTH_ROTATION: [number, number, number] = [0, Math.PI, 0]

// Cycled per slot so neighboring pieces don't all read the same size —
// the real image still keeps its own aspect ratio inside this box (see
// Artwork.tsx's contain-fit).
const SIZE_PRESETS: Array<[number, number]> = [
  [2.2, 1.5],
  [1.5, 2.1],
  [1.9, 1.9],
]

function wallSlots(
  roomId: string,
  xFrom: number,
  xTo: number,
  z: number,
  rotation: [number, number, number],
  count: number,
  presetOffset: number,
): GallerySlot[] {
  const margin = 1.6
  const usableFrom = xFrom + margin
  const usableTo = xTo - margin
  const step = count > 1 ? (usableTo - usableFrom) / (count - 1) : 0
  const baseY = 1.85

  return Array.from({ length: count }, (_, i) => {
    const x = count > 1 ? usableFrom + step * i : (xFrom + xTo) / 2
    const [width, height] = SIZE_PRESETS[(presetOffset + i) % SIZE_PRESETS.length]
    return {
      roomId,
      position: [x, baseY, z],
      rotation,
      width,
      height,
    }
  })
}

// 15 wall spots spread across the 6 long walls (3 rooms x north/south).
export const gallerySlots: GallerySlot[] = [
  ...wallSlots('room-01', -18, -6, NORTH_Z, NORTH_ROTATION, 3, 0),
  ...wallSlots('room-01', -18, -6, SOUTH_Z, SOUTH_ROTATION, 2, 1),
  ...wallSlots('room-02', -6, 6, NORTH_Z, NORTH_ROTATION, 2, 2),
  ...wallSlots('room-02', -6, 6, SOUTH_Z, SOUTH_ROTATION, 3, 0),
  ...wallSlots('room-03', 6, 18, NORTH_Z, NORTH_ROTATION, 2, 1),
  ...wallSlots('room-03', 6, 18, SOUTH_Z, SOUTH_ROTATION, 3, 2),
]
