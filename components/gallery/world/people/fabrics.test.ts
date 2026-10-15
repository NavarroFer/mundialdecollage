import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { cloth, FABRICS, foldNormals, toneOf, weaveField, type Fabric } from './fabrics'

const SIZE = 128
const fabrics = Object.keys(FABRICS) as Fabric[]

// Average jump between two neighboring columns (or rows) of pixels, `to`
// being 0 for the last column against the first one, across the tile's edge.
function jump(field: Float32Array, size: number, axis: 'x' | 'y', from: number, to: number) {
  let sum = 0
  for (let a = 0; a < size; a++) {
    sum += axis === 'x' ? Math.abs(field[a * size + from] - field[a * size + to]) : Math.abs(field[from * size + a] - field[to * size + a])
  }
  return sum / size
}

describe('fabrics', () => {
  it.each(fabrics)('%s repeats without a seam', (fabric) => {
    const field = weaveField(fabric, SIZE)
    for (const axis of ['x', 'y'] as const) {
      // Crossing the edge is no bigger a jump than between threads or stitches inside the tile.
      const inside = Math.max(...Array.from({ length: SIZE - 1 }, (_, i) => jump(field, SIZE, axis, i, i + 1)))
      expect(jump(field, SIZE, axis, SIZE - 1, 0)).toBeLessThan(inside * 1.1 + 0.002)
    }
  })

  it.each(fabrics)('%s has a visible texture without black holes', (fabric) => {
    const field = weaveField(fabric, SIZE)
    const mean = field.reduce((sum, value) => sum + value, 0) / field.length
    const spread = Math.sqrt(field.reduce((sum, value) => sum + (value - mean) ** 2, 0) / field.length)
    expect(spread).toBeGreaterThan(0.01)
    expect(Math.min(...field)).toBeGreaterThan(0.2)
  })

  it('keeps a plain garment its own color on average', () => {
    const { color } = cloth('denim', '#4d6587')
    const shaded = (color as THREE.Color).clone().multiplyScalar(toneOf(weaveField('denim')))
    const target = new THREE.Color('#4d6587')
    expect(shaded.r).toBeCloseTo(target.r, 3)
    expect(shaded.g).toBeCloseTo(target.g, 3)
    expect(shaded.b).toBeCloseTo(target.b, 3)
  })

  it('leaves the folds out of fabrics that have none', () => {
    expect(cloth('rubber', '#eadcc2').normalMap).toBeUndefined()
    expect(cloth('denim', '#4d6587').normalMap).toBeInstanceOf(THREE.Texture)
  })

  it('folds into unit normals that tilt at most about 45°', () => {
    const normals = foldNormals(64)
    for (let p = 0; p < normals.length; p += 3) {
      expect(Math.hypot(normals[p], normals[p + 1], normals[p + 2])).toBeCloseTo(1, 5)
      expect(normals[p + 2]).toBeGreaterThan(0.7)
    }
  })
})
