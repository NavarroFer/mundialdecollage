import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { LOBO } from './layout'
import { seaLionBodyGeometry, seaLionFaceGeometries, seaLionForeflipperGeometry, seaLionHindflipperGeometry } from './seaLionGeometry'

function sculpture() {
  const face = seaLionFaceGeometries()
  return [seaLionBodyGeometry(), seaLionForeflipperGeometry(1), seaLionForeflipperGeometry(-1), seaLionHindflipperGeometry(1), seaLionHindflipperGeometry(-1), ...face.gold, ...face.recesses]
}

describe('MAR sea lion', () => {
  it('keeps every body part inside the solid walk-map footprint and above its plinth', () => {
    const geometries = sculpture()
    const bounds = new THREE.Box3()
    for (const geometry of geometries) {
      geometry.computeBoundingBox()
      const box = geometry.boundingBox!
      expect(box.min.x + LOBO.head.x).toBeGreaterThan(LOBO.x0)
      expect(box.max.x + LOBO.head.x).toBeLessThan(LOBO.x1)
      expect(box.min.z + LOBO.head.z).toBeGreaterThan(LOBO.z0)
      expect(box.max.z + LOBO.head.z).toBeLessThan(LOBO.z1)
      expect(box.min.y).toBeGreaterThanOrEqual(0)
      bounds.union(box)
      for (const name of ['position', 'normal', 'uv']) {
        const attribute = geometry.getAttribute(name)
        for (const value of attribute.array) expect(Number.isFinite(value)).toBe(true)
      }
      geometry.dispose()
    }
    expect(bounds.max.y + LOBO.height).toBeGreaterThan(10)
    expect(bounds.max.y + LOBO.height).toBeLessThan(11)
  })

  it('has outward normals on the closed chest and a broad, tapered neck', () => {
    const geometry = seaLionBodyGeometry()
    const position = geometry.getAttribute('position')
    const normals = geometry.getAttribute('normal')
    let neckWidth = 0
    let chestWidth = 0
    let checked = 0
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i)
      const z = position.getZ(i)
      if (Math.abs(y - 7.2) < 0.1) neckWidth = Math.max(neckWidth, Math.abs(z) * 2)
      if (Math.abs(y - 4.9) < 0.1) chestWidth = Math.max(chestWidth, Math.abs(z) * 2)
      if (y > 5 && y < 9 && Math.abs(z) > 0.5) {
        expect(normals.getZ(i) * z).toBeGreaterThan(0)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(100)
    expect(neckWidth).toBeGreaterThan(3)
    expect(chestWidth).toBeGreaterThan(neckWidth)
    geometry.dispose()
  })
})
