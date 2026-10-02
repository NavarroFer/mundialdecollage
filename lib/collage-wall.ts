// The collective collage: a big frame on Room 1's end wall (x = -18) of the
// 3D gallery where visitors paste photos (app/galeria-3d/wall-actions.ts,
// components/gallery/wall). Pure — shared by the server and the browser.

export const WALL_BUCKET = 'wall'

/** `${user id}/${random uuid}.{jpg,webp,png}`, the only paths the gallery uploads. */
export const wallPhotoPattern = /^([0-9a-f-]{36})\/([0-9a-f-]{36}\.(jpg|webp|png))$/

/** WebP and PNG are only ever uploaded for cutouts: photos with a transparent background (components/gallery/wall/photo.ts). */
export const isCutoutPath = (path: string) => /\.(webp|png)$/.test(path)

export type WallPiece = {
  id: string
  url: string
  /** Where it was pasted: across (left to right) and up the frame, 0 to 1. */
  x: number
  y: number
  rotation: number
  /** A cutout with a transparent background: pasted as is, without the white photo card. */
  cutout: boolean
  /** Only ever true on the visitor's own pieces: nobody else sees them until approved. */
  pending: boolean
}

export type WallLives = { lives: number; nextLifeAt: string | null; unlimited: boolean }

export type WallState = {
  pieces: WallPiece[]
  lives: WallLives | null
  userId: string | null
  /** The Monday this collage started (YYYY-MM-DD, Argentina). */
  weekStart: string
}

export const MAX_LIVES = 3

// The frame, in world units (meters). Room 1's end wall runs z -5..5 and its
// inner face is at x = -17.9; the frame is hung centered on it.
export const WALL_FRAME = {
  /** The canvas's surface, just in front of the wall. */
  faceX: -17.86,
  centerZ: 0,
  width: 7.2,
  bottom: 0.9,
  height: 2.3,
  /** The longest side of a pasted photo, in meters. */
  piece: 0.65,
}

/** How far from the frame the visitor can be to paste on it. */
export const MAX_AIM_DISTANCE = 6

type Vec3 = { x: number; y: number; z: number }
export type WallPoint = { x: number; y: number }

// Facing the wall (looking toward -x) the visitor's right is -z, so "across"
// runs from z = +width/2 to z = -width/2.
export function wallPointToWorld({ x, y }: WallPoint): [number, number, number] {
  const { faceX, centerZ, width, bottom, height } = WALL_FRAME
  return [faceX, bottom + y * height, centerZ + width / 2 - x * width]
}

/**
 * Where the visitor's line of sight meets the frame, or null when they aren't
 * looking at it from close enough. Kept far enough from the edges that a
 * photo pasted there stays inside the frame.
 */
export function aimAtWall(origin: Vec3, direction: Vec3): WallPoint | null {
  const { faceX, centerZ, width, bottom, height, piece } = WALL_FRAME
  if (direction.x > -1e-3) return null
  const distance = (faceX - origin.x) / direction.x
  if (distance < 0 || distance > MAX_AIM_DISTANCE) return null
  const z = origin.z + distance * direction.z
  const y = origin.y + distance * direction.y
  const across = (centerZ + width / 2 - z) / width
  const up = (y - bottom) / height
  if (across < 0 || across > 1 || up < 0 || up > 1) return null
  const marginX = piece / 2 / width
  const marginY = piece / 2 / height
  return {
    x: Math.min(1 - marginX, Math.max(marginX, across)),
    y: Math.min(1 - marginY, Math.max(marginY, up)),
  }
}

/** Whole hours and minutes until the next life (rounded up, never negative). */
export function timeUntil(iso: string, now: number): { hours: number; minutes: number } {
  const minutes = Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 60_000))
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 }
}
