import { describe, expect, it } from 'vitest'
import { coverCrop } from './compose'

describe('coverCrop', () => {
  it('keeps the middle of a wide screen for a square photo', () => {
    expect(coverCrop(1920, 1080, 1)).toEqual({ sx: 420, sy: 0, sw: 1080, sh: 1080 })
  })

  it('keeps the middle of a tall screen for a square photo', () => {
    expect(coverCrop(1000, 1600, 1)).toEqual({ sx: 0, sy: 300, sw: 1000, sh: 1000 })
  })

  it('takes the whole picture when it already has the ratio', () => {
    expect(coverCrop(800, 800, 1)).toEqual({ sx: 0, sy: 0, sw: 800, sh: 800 })
  })
})
