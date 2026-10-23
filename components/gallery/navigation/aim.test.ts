import { describe, expect, it } from 'vitest'
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Raycaster, Vector3 } from 'three'
import { aimAt } from './aim'

function plane(z: number, userData: Record<string, unknown> = {}) {
  const mesh = new Mesh(new PlaneGeometry(2, 2), new MeshBasicMaterial())
  mesh.position.z = z
  mesh.userData = userData
  mesh.updateMatrixWorld()
  return mesh
}

function aim(...objects: Mesh[]) {
  const scene = new Group()
  scene.add(...objects)
  scene.updateMatrixWorld(true)
  const ray = new Raycaster(new Vector3(0, 0, 0), new Vector3(0, 0, -1))
  return aimAt(ray.intersectObjects(scene.children, true))
}

describe('aimAt', () => {
  it('names the obra under the pointer, with how far it is', () => {
    expect(aim(plane(-3, { attentionArtworkId: 'obra' }))).toEqual({ kind: 'artwork', id: 'obra', distance: 3 })
  })

  it('walks to whatever else is hit first, even in front of an obra', () => {
    expect(aim(plane(-1), plane(-3, { attentionArtworkId: 'obra' }))).toEqual({ kind: 'spot', point: { x: 0, z: -1 } })
  })

  it('looks through the destination marker and hidden objects', () => {
    const hidden = plane(-1)
    hidden.visible = false
    expect(aim(plane(-0.5, { navigationMarker: true }), hidden, plane(-2, { attentionArtworkId: 'obra' }))).toMatchObject({ kind: 'artwork', id: 'obra' })
  })

  it('finds nothing in an empty direction', () => {
    expect(aim()).toBeNull()
  })
})

it('recognizes the arcade through its parent group and respects occlusion', () => {
  const cabinet = new Group()
  cabinet.userData.arcade = true
  cabinet.add(plane(-2))
  cabinet.updateMatrixWorld(true)
  const ray = new Raycaster(new Vector3(), new Vector3(0, 0, -1))
  expect(aimAt(ray.intersectObjects([cabinet], true))).toEqual({ kind: 'arcade', distance: 2 })
  expect(aimAt(ray.intersectObjects([plane(-1), cabinet], true))?.kind).toBe('spot')
})
