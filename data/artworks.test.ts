import { describe, expect, it } from 'vitest'
import { gallerySlots } from './artworks'

const WALLS = [
  { roomId: 'room-01', z: -4.9, xFrom: -18, xTo: -6 },
  { roomId: 'room-01', z: 4.9, xFrom: -18, xTo: -6 },
  { roomId: 'room-02', z: -4.9, xFrom: -6, xTo: 6 },
  { roomId: 'room-02', z: 4.9, xFrom: -6, xTo: 6 },
  { roomId: 'room-03', z: -4.9, xFrom: 6, xTo: 18 },
  { roomId: 'room-03', z: 4.9, xFrom: 6, xTo: 18 },
]

describe('gallerySlots', () => {
  it('leaves equal visible gaps between frames and wall edges', () => {
    for (const wall of WALLS) {
      const slots = gallerySlots
        .filter((slot) => slot.roomId === wall.roomId && slot.position[2] === wall.z)
        .sort((a, b) => a.position[0] - b.position[0])

      const gaps = [
        slots[0].position[0] - slots[0].width / 2 - wall.xFrom,
        ...slots.slice(1).map((slot, index) => {
          const previous = slots[index]
          return slot.position[0] - slot.width / 2 - (previous.position[0] + previous.width / 2)
        }),
        wall.xTo - (slots.at(-1)!.position[0] + slots.at(-1)!.width / 2),
      ]

      for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0], 10)
    }
  })
})
