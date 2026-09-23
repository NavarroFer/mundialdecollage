import { describe, expect, it } from 'vitest'
import { gallerySlots } from './artworks'

const WALLS = [
  { roomId: 'room-01', axis: 'x', fixed: -4.9, from: -18, to: -6 },
  { roomId: 'room-01', axis: 'x', fixed: 4.9, from: -18, to: -6 },
  { roomId: 'room-01', axis: 'z', fixed: -17.9, from: -5, to: 5 },
  { roomId: 'room-01', axis: 'z', fixed: -6.1, from: -5, to: -1.2 },
  { roomId: 'room-02', axis: 'x', fixed: -4.9, from: -6, to: 6 },
  { roomId: 'room-02', axis: 'x', fixed: 4.9, from: -6, to: 6 },
  { roomId: 'room-02', axis: 'z', fixed: -5.9, from: 1.2, to: 5 },
  { roomId: 'room-02', axis: 'z', fixed: 5.9, from: -5, to: -1.2 },
  { roomId: 'room-03', axis: 'x', fixed: -4.9, from: 6, to: 18 },
  { roomId: 'room-03', axis: 'x', fixed: 4.9, from: 6, to: 18 },
  { roomId: 'room-03', axis: 'z', fixed: 17.9, from: -5, to: 5 },
  { roomId: 'room-03', axis: 'z', fixed: 6.1, from: 1.2, to: 5 },
] as const

describe('gallerySlots', () => {
  it('keeps 20 works while using long, end, and doorway walls', () => {
    expect(gallerySlots).toHaveLength(20)
    expect(gallerySlots.filter((slot) => Math.abs(slot.position[0]) > 17)).toHaveLength(4)
    expect(gallerySlots.filter((slot) => Math.abs(slot.position[0]) > 5 && Math.abs(slot.position[0]) < 7)).toHaveLength(4)
  })

  it('leaves equal visible gaps between frames and wall edges', () => {
    for (const wall of WALLS) {
      const slots = gallerySlots
        .filter((slot) => slot.roomId === wall.roomId && slot.position[wall.axis === 'x' ? 2 : 0] === wall.fixed)
        .sort((a, b) => a.position[wall.axis === 'x' ? 0 : 2] - b.position[wall.axis === 'x' ? 0 : 2])

      expect(slots.length).toBeGreaterThan(0)
      const coordinate = (slot: (typeof slots)[number]) => slot.position[wall.axis === 'x' ? 0 : 2]

      const gaps = [
        coordinate(slots[0]) - slots[0].width / 2 - wall.from,
        ...slots.slice(1).map((slot, index) => {
          const previous = slots[index]
          return coordinate(slot) - slot.width / 2 - (coordinate(previous) + previous.width / 2)
        }),
        wall.to - (coordinate(slots.at(-1)!) + slots.at(-1)!.width / 2),
      ]

      for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0], 10)
    }
  })
})
