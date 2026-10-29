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

/**
 * A kraft frame visitors paste on, in world units (meters): its centre on
 * the floor plan, the way its face looks (`yaw`, radians: 0 faces +z,
 * π/2 faces +x) and its size.
 */
export type WallFrame = {
  center: [x: number, z: number]
  yaw: number
  width: number
  bottom: number
  height: number
  /** The longest side of a pasted photo, in meters. */
  piece: number
  /** Where the museum plaque goes, if the frame has one under it. */
  plaqueY?: number
  /** A board on legs in the middle of a room, rather than one hung on a wall. */
  freestanding?: boolean
}

// The museum's collective collage. Room 1's end wall runs z -5..5 and its
// inner face is at x = -17.9; the frame is hung centered on it.
export const WALL_FRAME: WallFrame = {
  center: [-17.86, 0],
  yaw: Math.PI / 2,
  width: 7.2,
  bottom: 0.9,
  height: 2.3,
  piece: 0.65,
  plaqueY: 0.52,
}

/** How far from the frame the visitor can be to paste on it. */
export const MAX_AIM_DISTANCE = 6

type Vec3 = { x: number; y: number; z: number }
export type WallPoint = { x: number; y: number }

/** The way the frame's face looks, on the floor plan. */
const normalOf = ({ yaw }: WallFrame) => [Math.sin(yaw), Math.cos(yaw)] as const
/** Facing the frame, the visitor's right: "across" runs from left (0) to right (1). */
const rightOf = ({ yaw }: WallFrame) => [Math.cos(yaw), -Math.sin(yaw)] as const

/** A spot of the frame in the world, `lift` meters in front of its face. */
export function wallPointToWorld({ x, y }: WallPoint, frame: WallFrame = WALL_FRAME, lift = 0): [number, number, number] {
  const [nx, nz] = normalOf(frame)
  const [rx, rz] = rightOf(frame)
  const across = (x - 0.5) * frame.width
  return [frame.center[0] + rx * across + nx * lift, frame.bottom + y * frame.height, frame.center[1] + rz * across + nz * lift]
}

/**
 * Where the visitor's line of sight meets the frame, or null when they aren't
 * looking at it from close enough. Kept far enough from the edges that a
 * photo pasted there stays inside the frame.
 */
export function aimAtWall(origin: Vec3, direction: Vec3, frame: WallFrame = WALL_FRAME): WallPoint | null {
  const { center, width, bottom, height, piece } = frame
  const [nx, nz] = normalOf(frame)
  const [rx, rz] = rightOf(frame)
  // Only from in front: looking against the way the face looks.
  const facing = direction.x * nx + direction.z * nz
  if (facing > -1e-3) return null
  const distance = ((center[0] - origin.x) * nx + (center[1] - origin.z) * nz) / facing
  if (distance < 0 || distance > MAX_AIM_DISTANCE) return null
  const hitX = origin.x + distance * direction.x
  const hitZ = origin.z + distance * direction.z
  const y = origin.y + distance * direction.y
  const across = ((hitX - center[0]) * rx + (hitZ - center[1]) * rz) / width + 0.5
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
