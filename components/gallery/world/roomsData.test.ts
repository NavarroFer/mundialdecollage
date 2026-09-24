import { describe, expect, it } from 'vitest'
import { GALLERY_BOUNDS, SKYLIGHT, ceilingAroundSkylights, rooms } from './roomsData'

const area = ([x0, z0, x1, z1]: [number, number, number, number]) => (x1 - x0) * (z1 - z0)

describe('ceilingAroundSkylights', () => {
  it('covers the whole gallery except one skylight per room', () => {
    const panels = ceilingAroundSkylights()
    const covered = panels.reduce((total, panel) => total + area(panel), 0)
    expect(covered).toBeCloseTo(area(GALLERY_BOUNDS) - rooms.length * SKYLIGHT.width * SKYLIGHT.depth)
    for (const [x0, z0, x1, z1] of panels) {
      expect(x1).toBeGreaterThan(x0)
      expect(z1).toBeGreaterThan(z0)
    }
  })
})
