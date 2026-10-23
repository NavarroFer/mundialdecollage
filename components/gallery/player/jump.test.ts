import { describe, expect, it } from 'vitest'
import { HOP_SECONDS, hopHeight } from './jump'

describe('hopHeight', () => {
  it('rises about half a metre and lands after two thirds of a second', () => {
    expect(hopHeight(HOP_SECONDS / 2)).toBeCloseTo(0.52, 2)
    expect(HOP_SECONDS).toBeCloseTo(0.65, 2)
  })

  it('stays on the floor before and after the hop', () => {
    expect(hopHeight(0)).toBe(0)
    expect(hopHeight(-1)).toBe(0)
    expect(hopHeight(HOP_SECONDS)).toBe(0)
    expect(hopHeight(5)).toBe(0)
  })
})
