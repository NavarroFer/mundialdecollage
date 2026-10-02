import { describe, expect, it } from 'vitest'
import { aimAtWall, timeUntil, wallPhotoPattern, wallPointToWorld, WALL_FRAME } from './collage-wall'

const west = { x: -1, y: 0, z: 0 }

describe('aimAtWall', () => {
  it('finds the middle of the frame straight ahead', () => {
    const point = aimAtWall({ x: -15, y: WALL_FRAME.bottom + WALL_FRAME.height / 2, z: 0 }, west)
    expect(point?.x).toBeCloseTo(0.5)
    expect(point?.y).toBeCloseTo(0.5)
  })

  it('puts the visitor\'s right (-z) toward the right of the frame', () => {
    const point = aimAtWall({ x: -15, y: 1.9, z: -2 }, west)
    expect(point!.x).toBeGreaterThan(0.5)
  })

  it('ignores the frame from too far, from behind, or off its edges', () => {
    expect(aimAtWall({ x: -11, y: 1.9, z: 0 }, west)).toBeNull()
    expect(aimAtWall({ x: -15, y: 1.9, z: 0 }, { x: 1, y: 0, z: 0 })).toBeNull()
    expect(aimAtWall({ x: -15, y: 1.9, z: 4.5 }, west)).toBeNull()
    expect(aimAtWall({ x: -15, y: 0.2, z: 0 }, west)).toBeNull()
  })

  it('keeps a photo pasted at the edge inside the frame', () => {
    const point = aimAtWall({ x: -15, y: WALL_FRAME.bottom + 0.01, z: WALL_FRAME.width / 2 - 0.01 }, west)!
    const [, y, z] = wallPointToWorld(point)
    expect(y - WALL_FRAME.piece / 2).toBeGreaterThanOrEqual(WALL_FRAME.bottom - 1e-9)
    expect(z + WALL_FRAME.piece / 2).toBeLessThanOrEqual(WALL_FRAME.width / 2 + 1e-9)
  })

  it('maps back to the same spot in the world', () => {
    const origin = { x: -14, y: 1.6, z: 1.3 }
    const [x, y, z] = wallPointToWorld(aimAtWall(origin, west)!)
    expect([x, y, z]).toEqual([WALL_FRAME.faceX, expect.closeTo(1.6), expect.closeTo(1.3)])
  })
})

describe('timeUntil', () => {
  it('rounds up to whole minutes', () => {
    const now = Date.parse('2026-10-02T10:00:00Z')
    expect(timeUntil('2026-10-02T12:14:30Z', now)).toEqual({ hours: 2, minutes: 15 })
    expect(timeUntil('2026-10-02T09:00:00Z', now)).toEqual({ hours: 0, minutes: 0 })
  })
})

describe('wallPhotoPattern', () => {
  it('accepts only a visitor folder and a random .jpg name', () => {
    const id = '11111111-2222-3333-4444-555555555555'
    expect(wallPhotoPattern.exec(`${id}/${id}.jpg`)?.[1]).toBe(id)
    expect(wallPhotoPattern.test(`${id}/../x.jpg`)).toBe(false)
    expect(wallPhotoPattern.test(`${id}/${id}.png`)).toBe(true)
    expect(wallPhotoPattern.test(`${id}/${id}.gif`)).toBe(false)
  })
})
