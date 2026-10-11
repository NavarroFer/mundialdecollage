import type { Intersection, Object3D } from 'three'

/** Input must be nearest-first, as returned by THREE.Raycaster. */
export function attentionArtwork(hits: Intersection<Object3D>[]): string | null {
  const hit = hits.find(({ object }) => {
    let current: Object3D | null = object
    while (current) { if (!current.visible) return false; current = current.parent }
    return true
  })
  const slug: unknown = hit?.object.userData.attentionArtworkId
  return typeof slug === 'string' ? slug : null
}
