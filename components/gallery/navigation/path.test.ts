import { describe, expect, it } from 'vitest'
import { DOOR_WIDTH, GARDEN_FLOWERS, clubGalleryTemplates, doorways } from '../world/roomsData'
import { findWalkPath, viewingSpot, walkable, type Point } from './path'

// The hall's doorway into Room 1.
const [doorX, , doorZ] = doorways.find(({ id }) => id === 'door-1-2')!.center

// Every leg of a route stays on walkable floor.
function legsAreClear(from: Point, route: Point[]) {
  return [from, ...route].slice(1).every((point, index, points) => {
    const start = index === 0 ? from : points[index - 1]
    return Array.from({ length: 20 }, (_, step) => ({
      x: start.x + ((point.x - start.x) * (step + 1)) / 20,
      z: start.z + ((point.z - start.z) * (step + 1)) / 20,
    })).every((sample) => walkable(sample) || Math.hypot(sample.x - from.x, sample.z - from.z) < 0.6)
  })
}

describe('walkable', () => {
  it('keeps the player off walls, out of the gallery edge and away from garden flowers', () => {
    expect(walkable({ x: 0, z: 0 })).toBe(true)
    expect(walkable({ x: doorX, z: doorZ + DOOR_WIDTH })).toBe(false)
    expect(walkable({ x: doorX, z: doorZ })).toBe(true)
    expect(walkable({ x: 0, z: -4.8 })).toBe(false)
    expect(walkable({ x: 20, z: 0 })).toBe(false)
    expect(walkable({ x: Number.NaN, z: 0 })).toBe(false)
    const flower = GARDEN_FLOWERS[0]
    expect(walkable({ x: flower.x, z: flower.z })).toBe(true)
    expect(walkable({ x: flower.x, z: flower.z }, true)).toBe(false)
  })
})

describe('findWalkPath', () => {
  it('walks straight across an open room', () => {
    expect(findWalkPath({ x: 0, z: -0.5 }, { x: 3, z: 2 })).toEqual([{ x: 3, z: 2 }])
  })

  it('goes through the doorway to reach the next room', () => {
    const from = { x: 0, z: 3.5 }
    const route = findWalkPath(from, { x: -15, z: 3.5 })
    expect(route).not.toBeNull()
    expect(route!.at(-1)).toEqual({ x: -15, z: 3.5 })
    expect(route!.some((point) => Math.abs(point.z - doorZ) < DOOR_WIDTH / 2 && Math.abs(point.x - doorX) < 1)).toBe(true)
    expect(legsAreClear(from, route!)).toBe(true)
  })

  it('stops at the nearest walkable spot for a click right next to a wall', () => {
    const route = findWalkPath({ x: 0, z: 0 }, { x: 2, z: -4.8 })
    expect(route).not.toBeNull()
    expect(walkable(route!.at(-1)!)).toBe(true)
    expect(route!.at(-1)!.z).toBeLessThan(-3.5)
  })

  it('gives up on points outside the gallery', () => {
    expect(findWalkPath({ x: 0, z: 0 }, { x: 40, z: 0 })).toBeNull()
    expect(findWalkPath({ x: 0, z: 0 }, { x: Number.NaN, z: 0 })).toBeNull()
  })

  it('routes around the garden flowers', () => {
    const flower = GARDEN_FLOWERS[0]
    const from = { x: flower.x + 2, z: flower.z + 0.2 }
    const route = findWalkPath(from, { x: flower.x - 1.2, z: flower.z + 0.2 }, true)
    expect(route).not.toBeNull()
    for (const point of route!) expect(Math.hypot(point.x - flower.x, point.z - flower.z)).toBeGreaterThanOrEqual(0.75)
  })

  it('uses the selected Club layout and crosses the double gallery passage', () => {
    const template = clubGalleryTemplates.double
    const route = findWalkPath({ x: -3, z: 2.4 }, { x: 3, z: 2.4 }, false, template)
    expect(route).not.toBeNull()
    expect(route!.at(-1)).toEqual({ x: 3, z: 2.4 })
    for (const point of route!) expect(walkable(point, false, template)).toBe(true)
    expect(walkable({ x: 14, z: 0 }, false, template)).toBe(false)
  })
})

describe('viewingSpot', () => {
  it('stands in front of the obra, further back for bigger ones', () => {
    const artwork = { position: [0, 1.6, -4.9] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], width: 1, height: 1.2 }
    const spot = viewingSpot(artwork)
    expect(spot.x).toBeCloseTo(0)
    expect(spot.z).toBeCloseTo(-4.9 + 1.2 * 0.62 + 0.75)
    expect(walkable(spot)).toBe(true)
  })
})

 it('routes around the arcade and leaves its playing spot accessible', () => {
   expect(walkable({ x: 16.5, z: -4.25 })).toBe(false)
   expect(walkable({ x: 16.5, z: -2.55 }, true)).toBe(true)
   const from = { x: 15.5, z: -3 }
   const route = findWalkPath(from, { x: 17.2, z: -3.5 })
   expect(route).not.toBeNull()
   expect(legsAreClear(from, route!)).toBe(true)
 })
