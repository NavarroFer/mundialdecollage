import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { loft } from './loft'

function faceNormals(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute('position')
  const index = geometry.getIndex()!
  const [a, b, c] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  const faces: { center: THREE.Vector3; normal: THREE.Vector3 }[] = []
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(position, index.getX(i))
    b.fromBufferAttribute(position, index.getX(i + 1))
    c.fromBufferAttribute(position, index.getX(i + 2))
    const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a))
    if (normal.lengthSq() > 1e-12) faces.push({ center: a.clone().add(b).add(c).divideScalar(3), normal })
  }
  return faces
}

describe('loft', () => {
  it('builds a closed tube whose faces all point outward', () => {
    const geometry = loft([[0, 1, 1], [1, 1, 1], [2, 0.5, 0.5]], { segments: 6 })
    for (const { center, normal } of faceNormals(geometry)) {
      // Away from the axis on the sides, up or down on the caps.
      const outward = new THREE.Vector3(center.x, center.y - 1, center.z)
      expect(normal.dot(outward)).toBeGreaterThan(0)
    }
  })

  it('leaves an arc open, with no caps', () => {
    const geometry = loft([[0, 1, 1], [1, 1, 1]], { segments: 4, arc: [0.5, Math.PI * 2 - 0.5] })
    expect(geometry.getAttribute('position').count).toBe(2 * 5)
    expect(geometry.getIndex()!.count).toBe(4 * 6)
  })

  it('measures UVs in meters: around the tube, then up it', () => {
    const uv = loft([[0, 0.1, 0.1], [0.5, 0.1, 0.1]], { segments: 64, capTop: false, capBottom: false }).getAttribute('uv')
    const us = Array.from({ length: uv.count }, (_, i) => uv.getX(i))
    const vs = Array.from({ length: uv.count }, (_, i) => uv.getY(i))
    expect(Math.max(...us)).toBeCloseTo(2 * Math.PI * 0.1, 3)
    expect(Math.max(...vs)).toBeCloseTo(0.5, 5)
  })

  it('puts a closed tube’s seam at the back', () => {
    const position = loft([[0, 1, 1], [1, 1, 1]], { segments: 8 }).getAttribute('position')
    expect(position.getX(0)).toBeCloseTo(0)
    expect(position.getZ(0)).toBeCloseTo(-1)
  })

  it('maps caps from above, at the scale of the tube', () => {
    const geometry = loft([[0, 0.2, 0.1], [1, 0.2, 0.1]], { segments: 8 })
    const position = geometry.getAttribute('position')
    const uv = geometry.getAttribute('uv')
    // The last vertex is the top cap's center; the 9 before it, its ring.
    for (let i = position.count - 10; i < position.count; i++) {
      expect(uv.getX(i)).toBeCloseTo(position.getX(i))
      expect(uv.getY(i)).toBeCloseTo(position.getZ(i))
    }
  })

  it('repeats the first column of a closed tube so the seam lines up', () => {
    const position = loft([[0, 1, 1], [1, 1, 1]], { segments: 8, jitter: 0.2, pleat: 0.1 }).getAttribute('position')
    expect(position.getX(8)).toBeCloseTo(position.getX(0))
    expect(position.getZ(8)).toBeCloseTo(position.getZ(0))
  })
})
