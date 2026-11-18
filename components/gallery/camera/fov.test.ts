import { describe, expect, it } from 'vitest'
import { BASE_FOV, MAR_FOV, MIN_HORIZONTAL_FOV, horizontalFov, verticalFov } from './fov'

describe('verticalFov', () => {
  it('keeps the usual view on a computer and on a phone held sideways', () => {
    expect(verticalFov(16 / 9)).toBe(BASE_FOV)
    expect(verticalFov(844 / 390)).toBe(BASE_FOV)
    // A tablet held upright already sees more than the minimum across.
    expect(verticalFov(3 / 4)).toBe(BASE_FOV)
  })

  it('opens up on a phone held upright so the view is not a slit', () => {
    const aspect = 390 / 844
    expect(horizontalFov(BASE_FOV, aspect)).toBeLessThan(40)
    const fov = verticalFov(aspect)
    expect(fov).toBeGreaterThan(BASE_FOV)
    expect(horizontalFov(fov, aspect)).toBeCloseTo(MIN_HORIZONTAL_FOV)
  })

  it('uses the MAR lens on desktop while preserving mobile horizontal coverage', () => {
    expect(verticalFov(16 / 9, MAR_FOV)).toBe(55)
    expect(horizontalFov(verticalFov(390 / 844, MAR_FOV), 390 / 844)).toBeCloseTo(MIN_HORIZONTAL_FOV)
    expect(verticalFov(0, MAR_FOV)).toBe(MAR_FOV)
  })

  it('falls back to the usual view before the canvas has a size', () => {
    expect(verticalFov(0)).toBe(BASE_FOV)
    expect(verticalFov(Number.NaN)).toBe(BASE_FOV)
  })
})
