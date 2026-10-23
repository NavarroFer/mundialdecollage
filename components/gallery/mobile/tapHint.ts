import { Euler, Vector3, type Camera } from 'three'
import type { Artwork } from '@/data/artworks'

// Close enough to be a good size to tap on a phone's screen.
const MAX_METERS = 8
// Seen from much further to the side, the obra is a sliver (~66° off straight on).
const MIN_FACING = 0.4
// Its center well inside the screen, in normalized device coordinates: off
// the edges, above the joysticks and below the visit's buttons.
const MAX_X = 0.7
const MIN_Y = -0.45
const MAX_Y = 0.6

const eye = new Vector3()
const center = new Vector3()
const toEye = new Vector3()
const normal = new Vector3()
const turn = new Euler()

export type TapHintCandidate = { id: string; x: number; y: number; distance: number }

/**
 * The obras the first-visit "tap it" hint could point at, nearest first, each
 * with where its center falls on screen (normalized device coordinates):
 * close, facing the camera and well inside the screen. Whether something
 * stands in front of it is the raycaster's call (TapHintTracker).
 */
export function tapHintCandidates(artworks: Pick<Artwork, 'id' | 'position' | 'rotation'>[], camera: Camera): TapHintCandidate[] {
  camera.getWorldPosition(eye)
  const found: TapHintCandidate[] = []
  for (const { id, position, rotation } of artworks) {
    center.set(...position)
    const distance = center.distanceTo(eye)
    if (distance > MAX_METERS) continue
    // An obra's image faces its own +Z (Artwork.tsx).
    normal.set(0, 0, 1).applyEuler(turn.set(...rotation))
    if (normal.dot(toEye.subVectors(eye, center)) < MIN_FACING * distance) continue
    center.project(camera)
    // Behind the camera projects past the far plane.
    if (center.z > 1 || Math.abs(center.x) > MAX_X || center.y < MIN_Y || center.y > MAX_Y) continue
    found.push({ id, x: center.x, y: center.y, distance })
  }
  return found.sort((a, b) => a.distance - b.distance)
}
