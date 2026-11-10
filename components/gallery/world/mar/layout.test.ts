import { describe, expect, it } from 'vitest'
import { gallerySlots } from '@/data/artworks'
import { viewingSpot, walkable } from '../../navigation/path'
import { standInFront } from '../../player/spawn'
import {
  LOBO,
  MAR,
  MAR_BANNERS,
  MAR_DOORS,
  MAR_ESCALATORS,
  MAR_HANGINGS,
  MAR_SPAWN,
  blocksPath,
  marBoxes,
  marEscalatorHeight,
  marGallerySlots,
  marGalleryTemplate,
  marWalls,
  STAIR,
} from './layout'
import { artworksForVenue } from './place'

const STEP = 0.5

function reachableFrom(origin: { x: number; z: number }) {
  const cell = (x: number, z: number) => `${Math.round(x / STEP)},${Math.round(z / STEP)}`
  const seen = new Set([cell(origin.x, origin.z)])
  const queue = [origin]
  while (queue.length) {
    const { x, z } = queue.pop()!
    for (const [dx, dz] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]]) {
      const next = { x: x + dx, z: z + dz }
      const id = cell(next.x, next.z)
      if (seen.has(id) || !walkable(next, false, marGalleryTemplate, false)) continue
      seen.add(id)
      queue.push(next)
    }
  }
  return (x: number, z: number) => seen.has(cell(x, z))
}

describe('MAR layout', () => {
  it('keeps the Collage World Cup hanging list unchanged', () => {
    expect(gallerySlots).toHaveLength(37)
    expect(gallerySlots[0].roomId).toBe('room-01')
  })

  it('hangs one spot per daily obra, on walls that exist', () => {
    expect(MAR_HANGINGS.reduce((total, hanging) => total + hanging.count, 0)).toBe(37)
    expect(marGallerySlots).toHaveLength(37)
    for (const hanging of MAR_HANGINGS) expect(marWalls.some((wall) => wall.id === hanging.wall)).toBe(true)
  })

  it('starts on the plaza, outside the hall, with the entrance open', () => {
    expect(MAR_SPAWN.z).toBeGreaterThan(MAR_DOORS.entrance.z)
    expect(walkable(MAR_SPAWN, false, marGalleryTemplate, false)).toBe(true)
    expect(walkable({ x: 0, z: -1 }, false, marGalleryTemplate, false)).toBe(true)
    expect(walkable({ x: 0, z: 2 }, false, marGalleryTemplate, false)).toBe(true)
    // Glass beside the door is a wall. The door itself is not.
    expect(walkable({ x: MAR_DOORS.entrance.x0 - 0.4, z: 0 }, false, marGalleryTemplate, false)).toBe(false)
    expect(walkable({ x: 0, z: 0 }, false, marGalleryTemplate, false)).toBe(true)
    const entranceWidth = MAR_DOORS.entrance.x1 - MAR_DOORS.entrance.x0
    expect(entranceWidth).toBeGreaterThan(4)
    expect(entranceWidth).toBeLessThan(8)
  })

  it('lets a person walk from the plaza through the entrance to every room and every obra', () => {
    expect(walkable(MAR_SPAWN, false, marGalleryTemplate, false)).toBe(true)
    const reached = reachableFrom(MAR_SPAWN)
    for (const [name, point] of [
      ['hall', { x: 0, z: -8 }],
      ['west gallery', { x: -20, z: 0 }],
      ['east gallery', { x: 18, z: -15 }],
      ['auditorium aisle', { x: 0.4, z: -28 }],
    ] as const) {
      expect(reached(point.x, point.z), name).toBe(true)
    }
    for (const slot of marGallerySlots) {
      const spot = standInFront(slot)
      expect(walkable(spot, false, marGalleryTemplate, false), `${slot.roomId} ${slot.position}`).toBe(true)
      expect(reached(Math.round(spot.x / STEP) * STEP, Math.round(spot.z / STEP) * STEP), `${slot.roomId} ${slot.position}`).toBe(true)
      expect(viewingSpot(slot)).toEqual({ x: spot.x, z: spot.z })
    }
  })

  it('does not seal the ground floor with the mezzanine', () => {
    const deck = marBoxes.find((box) => box.id === 'mar-bridge')!
    expect(deck.minY).toBeGreaterThan(3)
    expect(blocksPath(deck)).toBe(false)
    expect(walkable({ x: 0, z: -10 }, false, marGalleryTemplate, false)).toBe(true)
  })

  it('climbs the escalator from the hall floor to the mezzanine deck', () => {
    const lane = MAR_ESCALATORS[0]
    expect(marEscalatorHeight((lane.x0 + lane.x1) / 2, lane.zBottom)).toBeCloseTo(0)
    expect(marEscalatorHeight((lane.x0 + lane.x1) / 2, lane.zTop)).toBeCloseTo(MAR.mezzanine)
    expect(marEscalatorHeight(0, -4)).toBeNull()
    const mid = marEscalatorHeight((lane.x0 + lane.x1) / 2, (lane.zBottom + lane.zTop) / 2)
    expect(mid).toBeGreaterThan(1)
    expect(mid).toBeLessThan(MAR.mezzanine)
  })

  it('leaves the main gallery furniture out of the MAR walk', () => {
    // The arcade cabinet's usual spot falls inside the east room's footprint.
    expect(walkable({ x: 16.5, z: -4.25 }, false, marGalleryTemplate, true)).toBe(false)
    expect(walkable({ x: 16.5, z: -4.25 }, false, marGalleryTemplate, false)).toBe(true)
  })

  it('keeps panel joints and the door head as single adjustable numbers', () => {
    expect(MAR.panel.width).toBeGreaterThan(1)
    expect(MAR.panel.height).toBeGreaterThan(0.5)
    expect(MAR.doorHeight).toBeGreaterThan(2.4)
    expect(MAR.hallHeight).toBeGreaterThan(MAR.mezzanine + 2)
  })
})

describe('MAR facade', () => {
  it('keeps the revolving door and the glass beside the swing doors closed, and only the swing doors open', () => {
    expect(walkable({ x: -4, z: 0.9 }, false, marGalleryTemplate, false)).toBe(false)
    expect(walkable({ x: 3.4, z: 0 }, false, marGalleryTemplate, false)).toBe(false)
    expect(walkable({ x: 1, z: 0 }, false, marGalleryTemplate, false)).toBe(true)
    expect(walkable({ x: 1, z: 1.5 }, false, marGalleryTemplate, false)).toBe(true)
  })

  it('keeps people off the sea lion platform, the stair well and the vent housing', () => {
    expect(walkable({ x: (LOBO.x0 + LOBO.x1) / 2, z: (LOBO.z0 + LOBO.z1) / 2 }, false, marGalleryTemplate, false)).toBe(false)
    expect(walkable({ x: (STAIR.x0 + STAIR.x1) / 2, z: (STAIR.z0 + STAIR.z1) / 2 }, false, marGalleryTemplate, false)).toBe(false)
    expect(walkable({ x: 28, z: 5.5 }, false, marGalleryTemplate, false)).toBe(false)
    // The plaza on both sides of them stays open, so the walk can go round.
    expect(walkable({ x: LOBO.x0 - 1.5, z: 13 }, false, marGalleryTemplate, false)).toBe(true)
    expect(walkable({ x: 14, z: LOBO.z1 + 1.5 }, false, marGalleryTemplate, false)).toBe(true)
    expect(reachableFrom(MAR_SPAWN)(30, 12)).toBe(true)
  })

  it('does not let the volumes over the plaza close the walk beneath them', () => {
    for (const id of ['mar-logo-slab', 'mar-west-lip', 'mar-banner-up']) {
      const box = marBoxes.find((item) => item.id === id)!
      expect(blocksPath(box), id).toBe(false)
    }
    // The vinyl volume's ground floor is set back; its upper floors overhang it.
    const low = marBoxes.find((item) => item.id === 'mar-banner-low')!
    const up = marBoxes.find((item) => item.id === 'mar-banner-up')!
    expect(up.maxZ).toBeGreaterThan(low.maxZ)
  })

  it('keeps every banner on a wall it fits, so a picture can be swapped in without moving anything', () => {
    expect(MAR_BANNERS.map((banner) => banner.id)).toEqual(['door-a', 'door-b', 'door-c', 'vinyl'])
    for (const banner of MAR_BANNERS) {
      expect(banner.image).toBeUndefined()
      expect(banner.width).toBeGreaterThan(0.5)
      expect(banner.center[1] - banner.height / 2).toBeGreaterThanOrEqual(0)
      expect(banner.center[1] + banner.height / 2).toBeLessThanOrEqual(MAR.soffit - 0.5 + 0.1 + 0.4)
    }
  })

  it('stands the volumes at the heights the photographs show', () => {
    expect(MAR.westExterior).toBeGreaterThan(MAR.logoExterior)
    expect(MAR.logoExterior).toBeGreaterThan(MAR.eastExterior)
    expect(MAR.soffit).toBeGreaterThan(MAR.doorLeaf + 1.5)
  })
})

describe('artworksForVenue', () => {
  it('rehangs obras for MAR and returns the same list for the Collage World Cup', () => {
    const obras = marGallerySlots.slice(0, 4).map((slot, index) => ({
      id: `obra-${index}`,
      title: 't',
      artist: 'a',
      countryCode: 'AR',
      flagSvg: null,
      year: 2026,
      image: '/x.png',
      description: '',
      roomId: 'room-01',
      position: [index, 1, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      width: 1,
      height: 1,
    }))
    expect(artworksForVenue(obras, 'mundial')).toBe(obras)
    const hung = artworksForVenue(obras, 'mar')
    expect(hung.map((obra) => obra.id)).toEqual(obras.map((obra) => obra.id))
    expect(hung[0].position).not.toEqual(obras[0].position)
    expect(obras[0].roomId).toBe('room-01')
    expect(hung.every((obra) => obra.roomId.startsWith('mar-'))).toBe(true)
  })
})
