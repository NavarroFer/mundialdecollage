import type { Intersection, Object3D } from 'three'
import type { Point } from './path'

export type Aim =
  | { kind: 'arcade'; distance: number }
  | { kind: 'artwork'; id: string; distance: number }
  | { kind: 'spot'; point: Point }

/**
 * What a click on the scene points at, from the raycaster's hits (nearest
 * first): an obra's image, or else the spot of floor under whatever was hit
 * — a wall, the ceiling or a visitor still mean "walk over there".
 */
export function aimAt(hits: Intersection<Object3D>[]): Aim | null {
  const hit = hits.find(({ object }) => {
    if (object.userData.navigationMarker) return false
    for (let current: Object3D | null = object; current; current = current.parent) if (!current.visible) return false
    return true
  })
  if (!hit) return null
  for (let object: Object3D | null = hit.object; object; object = object.parent) if (object.userData.arcade) return { kind: 'arcade', distance: hit.distance }
  const id: unknown = hit.object.userData.attentionArtworkId
  if (typeof id === 'string') return { kind: 'artwork', id, distance: hit.distance }
  return { kind: 'spot', point: { x: hit.point.x, z: hit.point.z } }
}
