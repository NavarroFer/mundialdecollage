import { describe, expect, it } from 'vitest'
import { gallerySlots, hang } from '@/data/artworks'
import { levelAt, planRoute, targetLevel } from '../../navigation/levels'
import { viewingSpot, walkable } from '../../navigation/path'
import { standInFront } from '../../player/spawn'
import {
  GALLERY,
  LOBO,
  MAR,
  MAR_BANNERS,
  MAR_DOORS,
  MAR_ESCALATORS,
  MAR_HANGINGS,
  MAR_SPAWN,
  blocksPath,
  marBoxes,
  marCenter,
  marEscalatorHeight,
  marSize,
  marGallerySlots,
  marGalleryTemplate,
  marUpperTemplate,
  marWalls,
  STAIR,
} from './layout'
import { artworksForVenue } from './place'

const STEP = 0.5
const MAR_ESCALATORS_ENTRY = marGalleryTemplate.upper!.link.entry

function reachableFrom(origin: { x: number; z: number }, template = marGalleryTemplate) {
  const cell = (x: number, z: number) => `${Math.round(x / STEP)},${Math.round(z / STEP)}`
  const seen = new Set([cell(origin.x, origin.z)])
  const queue = [origin]
  while (queue.length) {
    const { x, z } = queue.pop()!
    for (const [dx, dz] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]]) {
      const next = { x: x + dx, z: z + dz }
      const id = cell(next.x, next.z)
      if (seen.has(id) || !walkable(next, false, template, false)) continue
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
    for (const hanging of MAR_HANGINGS) expect(marBoxes.some((box) => box.id === hanging.wall), hanging.wall).toBe(true)
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

  it('lets a person walk from the plaza through the entrance to every ground-floor room', () => {
    expect(walkable(MAR_SPAWN, false, marGalleryTemplate, false)).toBe(true)
    const reached = reachableFrom(MAR_SPAWN)
    for (const [name, point] of [
      ['hall', { x: 0, z: -8 }],
      ['west gallery', { x: -20, z: 0 }],
      ['east gallery', { x: 18, z: -15 }],
      ['auditorium aisle', { x: 0.4, z: -28 }],
      ['the escalator foot', MAR_ESCALATORS_ENTRY],
    ] as const) {
      expect(reached(point.x, point.z), name).toBe(true)
    }
  })

  it('hangs every obra on the upper floor, where each can be stood in front of and reached from the escalator', () => {
    const upper = marGalleryTemplate.upper!
    expect(upper.template).toBe(marUpperTemplate)
    expect(walkable(upper.link.entry, false, marGalleryTemplate, false)).toBe(true)
    expect(walkable(upper.link.exit, false, upper.template, false)).toBe(true)
    const reached = reachableFrom(upper.link.exit, upper.template)
    expect(reached(Math.round(upper.link.exit.x / STEP) * STEP, Math.round(upper.link.exit.z / STEP) * STEP)).toBe(true)
    // Every obra is upstairs, at the upper floor's height.
    for (const slot of marGallerySlots) {
      expect(slot.position[1], `${slot.roomId} ${slot.position}`).toBeGreaterThan(MAR.mezzanine + 0.5)
      expect(levelAt(slot.position[1], marGalleryTemplate)).toBe(1)
      const spot = standInFront(slot)
      expect(walkable(spot, false, upper.template, false), `${slot.roomId} ${slot.position}`).toBe(true)
      expect(reached(Math.round(spot.x / STEP) * STEP, Math.round(spot.z / STEP) * STEP), `${slot.roomId} ${slot.position}`).toBe(true)
      expect(viewingSpot(slot)).toEqual({ x: spot.x, z: spot.z })
    }
  })

  it('routes a visitor from the plaza up the escalator to an obra, and back down to the plaza', () => {
    const slot = marGallerySlots[0]
    const up = planRoute(MAR_SPAWN, 0, viewingSpot(slot), 1, false, marGalleryTemplate, false)
    expect(up).not.toBeNull()
    expect(up!.length).toBeGreaterThan(3)
    const link = marGalleryTemplate.upper!.link
    expect(up).toContainEqual(link.entry)
    expect(up).toContainEqual(link.exit)
    const down = planRoute(viewingSpot(slot), 1, MAR_SPAWN, 0, false, marGalleryTemplate, false)
    expect(down).not.toBeNull()
    expect(down).toContainEqual(link.exit)
  })

  it('knows which floor a height and a click are on', () => {
    expect(levelAt(1.7, marGalleryTemplate)).toBe(0)
    expect(levelAt(MAR.mezzanine + 1.7, marGalleryTemplate)).toBe(1)
    expect(levelAt(6.9, undefined)).toBe(0)
    // A floor click upstairs means upstairs; a high wall hit keeps you where you are.
    expect(targetLevel(MAR.mezzanine + 0.05, 0, marGalleryTemplate)).toBe(1)
    expect(targetLevel(0.02, 1, marGalleryTemplate)).toBe(0)
    expect(targetLevel(8, 0, marGalleryTemplate)).toBe(0)
    expect(targetLevel(8, 1, marGalleryTemplate)).toBe(1)
  })

  it('is a 30 × 30 m room, with a spot for each of the day\'s 37 obras and a metre of wall between them', () => {
    expect(GALLERY.x1 - GALLERY.x0).toBeCloseTo(30)
    expect(GALLERY.z1 - GALLERY.z0).toBeCloseTo(30)
    expect(marGallerySlots.length).toBeGreaterThanOrEqual(37)
    // On every wall and partition face, the frames leave a metre or more between them (and to the wall's ends): room for the wall text beside each.
    for (const hanging of MAR_HANGINGS) {
      const wall = marBoxes.find((box) => box.id === hanging.wall)!
      const alongX = wall.maxX - wall.minX > wall.maxZ - wall.minZ
      const slots = hang(hanging, marBoxes.map((box) => ({ id: box.id, position: marCenter(box), size: marSize(box) })))
      const spans = slots
        .map((slot) => [(alongX ? slot.position[0] : slot.position[2]) - slot.width / 2, (alongX ? slot.position[0] : slot.position[2]) + slot.width / 2])
        .sort((a, b) => a[0] - b[0])
      const [from, to] = alongX ? [wall.minX, wall.maxX] : [wall.minZ, wall.maxZ]
      expect(spans[0][0] - from, hanging.wall).toBeGreaterThan(1)
      expect(to - spans[spans.length - 1][1], hanging.wall).toBeGreaterThan(1)
      for (let i = 1; i < spans.length; i++) expect(spans[i][0] - spans[i - 1][1], hanging.wall).toBeGreaterThan(1)
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

  it('connects both escalators to the same reachable mezzanine and ground floor', () => {
    const ground = reachableFrom(MAR_SPAWN)
    const upper = reachableFrom(marGalleryTemplate.upper!.link.exit, marUpperTemplate)
    for (const lane of MAR_ESCALATORS) {
      const x = (lane.x0 + lane.x1) / 2
      const direction = Math.sign(lane.zTop - lane.zBottom)
      expect(marEscalatorHeight(x, lane.zBottom)).toBeCloseTo(0)
      expect(marEscalatorHeight(x, lane.zTop)).toBeCloseTo(MAR.mezzanine)
      expect(ground(Math.round(x * 2) / 2, Math.round((lane.zBottom - direction * 0.85) * 2) / 2), lane.id).toBe(true)
      expect(upper(Math.round(x * 2) / 2, Math.round((lane.zTop + direction * 0.7) * 2) / 2), lane.id).toBe(true)
    }
  })

  it('connects all four upper walkways while keeping the atrium void closed to walking', () => {
    const reached = reachableFrom(marGalleryTemplate.upper!.link.exit, marUpperTemplate)
    for (const [x, z] of [[-10.5, -8], [-10.5, -2], [0, -2], [10, -2], [10, -8], [10, -16]]) {
      expect(reached(x, z), `${x},${z}`).toBe(true)
    }
    expect(walkable({ x: 0, z: -8 }, false, marUpperTemplate, false)).toBe(false)
    expect(walkable({ x: 6.5, z: -7 }, false, marUpperTemplate, false)).toBe(false)
  })

  it('opens the artwork gallery beside the front window and seals its former rear entrance', () => {
    const reached = reachableFrom(marGalleryTemplate.upper!.link.exit, marUpperTemplate)
    expect(reached(-12, -2)).toBe(true)
    expect(reached(-13.5, -2)).toBe(true)
    // A decorative ground-floor lintel must not visually seal the upper doorway,
    // even when it is excluded from the navigation map.
    const eye = { x: -12, y: MAR.mezzanine + 1.7, z: -2 }
    const opaqueAtDoor = marBoxes.filter((box) => box.visual !== false && ['concrete', 'white'].includes(box.kind)
      && eye.x >= box.minX && eye.x <= box.maxX
      && eye.y >= box.minY && eye.y <= box.maxY
      && eye.z >= box.minZ && eye.z <= box.maxZ)
    expect(opaqueAtDoor.map((box) => box.id)).toEqual([])
    expect(walkable({ x: -12, z: -16.5 }, false, marUpperTemplate, false)).toBe(false)
    expect(reached(-4, 1.5)).toBe(true)
    expect(walkable({ x: -4, z: 3 }, false, marUpperTemplate, false)).toBe(false)
    expect(marBoxes.find((box) => box.id === 'mar-logo-win-glass')?.solid).not.toBe(false)
  })

  it('keeps the entry, café passage and shop approach connected around the furniture', () => {
    const reached = reachableFrom(MAR_SPAWN)
    for (const point of [{ x: 0, z: -2 }, { x: 6.5, z: -3 }, { x: -12, z: -3.5 }, { x: -20, z: 0 }, { x: -18, z: -2 }]) {
      expect(reached(point.x, point.z), JSON.stringify(point)).toBe(true)
    }
    expect(walkable({ x: -5.2, z: -0.95 }, false, marGalleryTemplate, false)).toBe(false)
  })

  it('puts the escalators left of the entrance, with open floor between their foot and the front wall', () => {
    for (const lane of MAR_ESCALATORS) {
      // Entering the door you face -Z, so left is -X.
      expect(lane.x1).toBeLessThan(MAR_DOORS.entrance.x0)
      expect(MAR_DOORS.entrance.z - lane.zBottom).toBeGreaterThanOrEqual(4)
      // And they are not jammed against the side walls either.
      expect(lane.x0 - -12).toBeGreaterThan(2)
    }
    // The foot is reachable on the ground floor, in the open hall.
    expect(walkable(marGalleryTemplate.upper!.link.entry, false, marGalleryTemplate, false)).toBe(true)
    expect(reachableFrom(MAR_SPAWN)(-8, -4.5)).toBe(true)
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
    expect(MAR_BANNERS.map((banner) => banner.id)).toEqual(['door-a', 'door-b', 'door-c', 'vinyl', 'standee-a', 'standee-b', 'standee-c'])
    for (const banner of MAR_BANNERS) expect(banner.image).toBeUndefined()
    for (const banner of MAR_BANNERS.filter((item) => !item.standee)) {
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
