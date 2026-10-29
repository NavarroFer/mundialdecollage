import { describe, expect, it } from 'vitest'
import { framePresentation } from './frameStyles'

describe('framePresentation', () => {
  it('keeps the standard frame tied to the selected room theme', () => {
    expect(framePresentation('standard', 'museum').outer).toBe('#b08a3e')
    expect(framePresentation('standard', 'collage').outer).toBe('#33271f')
  })

  it('defines distinct physical treatments for every unlockable mounting', () => {
    const wood = framePresentation('wood', 'collage')
    const gold = framePresentation('gold', 'collage')
    const blackMat = framePresentation('black-mat', 'collage')
    const pinned = framePresentation('pinned', 'collage')

    expect(wood.roughness).toBeGreaterThan(gold.roughness)
    expect(gold.metalness).toBeGreaterThan(0.5)
    expect(blackMat.mat).toBe('#111111')
    expect(pinned.border).toBe(0)
    expect(pinned.matMargin).toBe(0)
  })
})
