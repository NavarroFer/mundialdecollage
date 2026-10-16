import { describe, expect, it } from 'vitest'
import { NATURAL_WALK, walkRate } from './avatarMotion'

describe('walkRate', () => {
  it('plays the walk at the speed the person covers ground', () => {
    expect(walkRate(NATURAL_WALK.m, 'm')).toBeCloseTo(1)
    expect(walkRate(NATURAL_WALK.f * 0.8, 'f')).toBeCloseTo(0.8)
  })

  it('keeps a stroll from turning into slow motion, and a dash from a jog', () => {
    expect(walkRate(0.1, 'f')).toBe(0.6)
    expect(walkRate(4, 'm')).toBe(1.5)
  })
})
