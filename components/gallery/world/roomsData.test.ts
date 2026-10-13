import { describe, expect, it } from 'vitest'
import { WALL_FRAME } from '@/lib/collage-wall'
import { gallerySlots } from '@/data/artworks'
import { HALL_SPAWN, standInFront } from '../player/spawn'
import { DOOR_WIDTH, GALLERY_BOUNDS, ceilingAroundSkylights, doorways, rooms, skylightOf, walls, type Bounds } from './roomsData'

const area = ([x0, z0, x1, z1]: Bounds) => (x1 - x0) * (z1 - z0)
const [minX, minZ, maxX, maxZ] = GALLERY_BOUNDS
// Player.tsx's capsule radius, plus a little air.
const PLAYER_CLEARANCE = 0.4
// spawn.ts's fallback start, in the hall.
const SPAWN = { x: HALL_SPAWN.x, z: HALL_SPAWN.z }

function hitsWall(x: number, z: number, margin: number) {
  return walls.some(({ position, size }) => Math.abs(x - position[0]) < size[0] / 2 + margin && Math.abs(z - position[2]) < size[2] / 2 + margin)
}

function standable(x: number, z: number) {
  return x > minX + PLAYER_CLEARANCE && x < maxX - PLAYER_CLEARANCE && z > minZ + PLAYER_CLEARANCE && z < maxZ - PLAYER_CLEARANCE && !hitsWall(x, z, PLAYER_CLEARANCE)
}

/** Every floor cell the player can walk to from the spawn, on a 0.25 m grid. */
function reachableFromSpawn() {
  const step = 0.25
  const cell = (x: number, z: number) => `${Math.round(x / step)},${Math.round(z / step)}`
  const seen = new Set([cell(SPAWN.x, SPAWN.z)])
  const queue = [SPAWN]
  while (queue.length) {
    const { x, z } = queue.pop()!
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const next = { x: x + dx, z: z + dz }
      if (seen.has(cell(next.x, next.z)) || !standable(next.x, next.z)) continue
      seen.add(cell(next.x, next.z))
      queue.push(next)
    }
  }
  return (x: number, z: number) => seen.has(cell(x, z))
}

describe('ceilingAroundSkylights', () => {
  it('covers the whole gallery except one skylight per room', () => {
    const panels = ceilingAroundSkylights()
    const covered = panels.reduce((total, panel) => total + area(panel), 0)
    expect(covered).toBeCloseTo(area(GALLERY_BOUNDS) - rooms.reduce((total, room) => total + area(skylightOf(room)), 0))
    for (const [x0, z0, x1, z1] of panels) {
      expect(x1).toBeGreaterThan(x0)
      expect(z1).toBeGreaterThan(z0)
    }
  })
})

describe('layout', () => {
  it('starts the player on open floor, in the hall or in front of any obra', () => {
    expect(standable(SPAWN.x, SPAWN.z)).toBe(true)
    for (const slot of gallerySlots) {
      const { x, z } = standInFront(slot)
      expect(standable(x, z), `obra at ${slot.position}`).toBe(true)
    }
  })

  it('leaves every doorway open, with wall on both sides', () => {
    for (const { center, axis } of doorways) {
      const [x, , z] = center
      expect(hitsWall(x, z, 0)).toBe(false)
      const half = DOOR_WIDTH / 2 + 0.05
      expect(axis === 'z' ? hitsWall(x, z - half, 0) && hitsWall(x, z + half, 0) : hitsWall(x - half, z, 0) && hitsWall(x + half, z, 0)).toBe(true)
    }
  })

  it('lets the player walk from the entrance to every obra', () => {
    const reachable = reachableFromSpawn()
    for (const slot of gallerySlots) {
      const { x, z } = standInFront(slot)
      expect(reachable(Math.round(x * 4) / 4, Math.round(z * 4) / 4), `obra at ${slot.position}`).toBe(true)
    }
  })

  it('leaves at least 1.8 m to walk around each end of a free-standing panel', () => {
    for (const panel of walls.filter((wall) => wall.freestanding)) {
      const along = panel.size[0] > panel.size[2] ? 0 : 2
      for (const direction of [-1, 1]) {
        const end = [...panel.position]
        end[along] += direction * (panel.size[along] / 2 + 0.01)
        let clear = 0
        while (clear < 1.8) {
          const probe = [...end]
          probe[along] += direction * clear
          if (hitsWall(probe[0], probe[2], 0) || probe[0] <= minX || probe[0] >= maxX || probe[2] <= minZ || probe[2] >= maxZ) break
          clear += 0.05
        }
        expect(clear, `${panel.id} end ${direction}`).toBeGreaterThanOrEqual(1.8)
      }
    }
  })

  it("shows the whole collective collage from Room 1's doorway", () => {
    const door = doorways.find(({ id }) => id === 'door-1-2')!
    const from = { x: door.center[0] - 0.3, z: door.center[2] }
    for (const t of [-0.5, -0.25, 0, 0.25, 0.5]) {
      const to = { x: WALL_FRAME.faceX + 0.05, z: WALL_FRAME.centerZ + WALL_FRAME.width * t }
      const blocked = Array.from({ length: 100 }, (_, i) => i / 100).some((s) =>
        hitsWall(from.x + (to.x - from.x) * s, from.z + (to.z - from.z) * s, 0),
      )
      expect(blocked, `collage edge ${t}`).toBe(false)
    }
  })
})
