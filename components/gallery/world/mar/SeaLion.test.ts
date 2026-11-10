import { describe, expect, it } from 'vitest'
import { LOBO } from './layout'
import { sweptBodyGeometry } from './SeaLion'

describe('sweptBodyGeometry', () => {
  it('stays inside the sea lion slab, about nine metres to the top of its head and a broad column up there', () => {
    const geometry = sweptBodyGeometry()
    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    const { head, x0, x1, z0, z1 } = LOBO
    expect(box.min.x + head.x).toBeGreaterThan(x0)
    expect(box.max.x + head.x).toBeLessThan(x1)
    expect(box.min.z + head.z).toBeGreaterThan(z0)
    expect(box.max.z + head.z).toBeLessThan(z1)
    expect(box.max.y).toBeGreaterThan(9)
    expect(box.max.y).toBeLessThan(11)
    // Seven metres up, the neck is more than three metres across: a column, not a muzzle.
    let widest = 0
    const position = geometry.getAttribute('position')
    for (let i = 0; i < position.count; i++) if (Math.abs(position.getY(i) - 7.2) < 0.3) widest = Math.max(widest, Math.abs(position.getZ(i)))
    expect(widest * 2).toBeGreaterThan(3)
    for (let i = 0; i < position.count; i++) expect(Number.isFinite(position.getX(i) + position.getY(i) + position.getZ(i))).toBe(true)
  })
})
