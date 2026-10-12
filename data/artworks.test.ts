import { describe, expect, it } from 'vitest'
import { GALLERY_BOUNDS, walls } from '@/components/gallery/world/roomsData'
import { HANGINGS, gallerySlots, hang } from './artworks'

// The player's capsule radius (Player.tsx) plus a little air.
const CLEARANCE = 0.5

const [minX, minZ, maxX, maxZ] = GALLERY_BOUNDS

function hitsWall(x: number, z: number, margin: number, except?: string) {
  return walls.some(
    ({ id, position, size }) =>
      id !== except && Math.abs(x - position[0]) < size[0] / 2 + margin && Math.abs(z - position[2]) < size[2] / 2 + margin,
  )
}

// Where the camera glides to look at an obra, and where resuming the tour
// drops the player (Player.tsx).
function viewingSpot({ position, rotation, width, height }: (typeof gallerySlots)[number]) {
  const distance = Math.max(width, height) * 0.62 + 0.75
  return { x: position[0] + Math.sin(rotation[1]) * distance, z: position[2] + Math.cos(rotation[1]) * distance }
}

describe('gallerySlots', () => {
  it('has the 20 spots ensure_exhibition_today fills each day', () => {
    expect(gallerySlots).toHaveLength(20)
    expect(new Set(gallerySlots.map((slot) => slot.roomId))).toEqual(new Set(['room-01', 'room-02', 'room-03']))
  })

  it('leaves equal visible gaps between frames and the ends of each stretch', () => {
    for (const hanging of HANGINGS) {
      const wall = walls.find(({ id }) => id === hanging.wall)!
      const along = wall.size[0] > wall.size[2] ? 0 : 2
      const [from, to] = hanging.span ?? [wall.position[along] - wall.size[along] / 2, wall.position[along] + wall.size[along] / 2]
      const slots = hang(hanging).sort((a, b) => a.position[along] - b.position[along])
      const gaps = [
        slots[0].position[along] - slots[0].width / 2 - from,
        ...slots.slice(1).map((slot, index) => slot.position[along] - slot.width / 2 - (slots[index].position[along] + slots[index].width / 2)),
        to - (slots.at(-1)!.position[along] + slots.at(-1)!.width / 2),
      ]
      for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0], 10)
      expect(gaps[0], hanging.wall).toBeGreaterThan(0.35)
    }
  })

  it('hangs every frame flat on its own wall, clear of the walls around it', () => {
    for (const slot of gallerySlots) {
      const facing = { x: Math.sin(slot.rotation[1]), z: Math.cos(slot.rotation[1]) }
      // Just in front of the frame, across its whole width.
      for (const t of [-0.5, -0.25, 0, 0.25, 0.5]) {
        const x = slot.position[0] + facing.z * slot.width * t + facing.x * 0.05
        const z = slot.position[2] - facing.x * slot.width * t + facing.z * 0.05
        expect(hitsWall(x, z, 0), `${slot.roomId} at ${slot.position}`).toBe(false)
      }
      // And right behind it, a wall.
      expect(hitsWall(slot.position[0] - facing.x * 0.05, slot.position[2] - facing.z * 0.05, 0)).toBe(true)
    }
  })

  it('leaves room to stand in front of every obra', () => {
    for (const slot of gallerySlots) {
      const { x, z } = viewingSpot(slot)
      expect(x > minX + CLEARANCE && x < maxX - CLEARANCE && z > minZ + CLEARANCE && z < maxZ - CLEARANCE).toBe(true)
      expect(hitsWall(x, z, CLEARANCE), `${slot.roomId} at ${slot.position}`).toBe(false)
    }
  })
})
