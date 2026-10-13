import { describe, expect, it } from 'vitest'
import { gallerySlots } from '@/data/artworks'
import { HALL_SPAWN, pickSpawn, standInFront } from './spawn'

const north = { position: [0, 1.6, -4.9] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], width: 1, height: 1 }
const east = { position: [17.9, 1.6, 0] as [number, number, number], rotation: [0, -Math.PI / 2, 0] as [number, number, number], width: 1, height: 1 }

describe('standInFront', () => {
  it('stands out from the wall along the obra’s face, looking back at it', () => {
    expect(standInFront(north)).toEqual({ x: 0, z: expect.closeTo(-4.9 + 1.37), yaw: 0 })
    const spot = standInFront(east)
    expect(spot.x).toBeCloseTo(17.9 - 1.37)
    expect(spot.z).toBeCloseTo(0)
    expect(spot.yaw).toBe(-Math.PI / 2)
  })
})

describe('pickSpawn', () => {
  it('starts in front of whichever obra the dice land on', () => {
    expect(pickSpawn([north, east], () => 0)).toEqual(standInFront(north))
    expect(pickSpawn([north, east], () => 0.5)).toEqual(standInFront(east))
    expect(pickSpawn([north, east], () => 0.999999)).toEqual(standInFront(east))
  })

  it('spreads visits evenly over every wall slot', () => {
    const counts = new Map<number, number>()
    const draws = gallerySlots.length * 50
    for (let i = 0; i < draws; i++) {
      const spot = pickSpawn(gallerySlots, () => (i + 0.5) / draws)
      const slot = gallerySlots.findIndex((hanging) => standInFront(hanging).x === spot.x && standInFront(hanging).z === spot.z)
      counts.set(slot, (counts.get(slot) ?? 0) + 1)
    }
    expect(counts.size).toBe(gallerySlots.length)
    for (const count of counts.values()) expect(count).toBe(50)
  })

  it('falls back to the hall with no obra on the walls', () => {
    expect(pickSpawn([], () => 0.3)).toBe(HALL_SPAWN)
  })
})
