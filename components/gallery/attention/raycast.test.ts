import { describe, expect, it } from 'vitest'
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Raycaster, Vector3 } from 'three'
import { attentionArtwork } from './raycast'

describe('observation visibility', () => {
  it('counts the image but not an artwork behind a wall', () => {
    const image = new Mesh(new PlaneGeometry(2, 2), new MeshBasicMaterial())
    image.userData.attentionArtworkId = 'obra'
    image.position.z = -3
    const wall = new Mesh(new BoxGeometry(2, 2, 0.2), new MeshBasicMaterial())
    wall.position.z = -1
    const scene = new Group()
    scene.add(image)
    scene.updateMatrixWorld(true)
    const ray = new Raycaster(new Vector3(), new Vector3(0, 0, -1), 0.05, 5)
    expect(attentionArtwork(ray.intersectObjects(scene.children, true))).toBe('obra')
    scene.add(wall)
    scene.updateMatrixWorld(true)
    expect(attentionArtwork(ray.intersectObjects(scene.children, true))).toBeNull()
    wall.visible = false
    expect(attentionArtwork(ray.intersectObjects(scene.children, true))).toBe('obra')
    image.position.z = -6
    scene.updateMatrixWorld(true)
    expect(attentionArtwork(ray.intersectObjects(scene.children, true))).toBeNull()
    image.geometry.dispose(); image.material.dispose(); wall.geometry.dispose(); wall.material.dispose()
  })
})
