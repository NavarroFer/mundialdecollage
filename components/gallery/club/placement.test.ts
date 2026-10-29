import { describe, expect, it } from 'vitest'
import { clubGallerySlots } from '@/data/artworks'
import { clubGalleryTemplates, type ClubGalleryTemplateId } from '../world/roomsData'
import { clubBoardFrame } from './board'
import { clubHostSpot } from './ClubHost'

// The Club room's furniture (the kraft board, the host) must never stand
// where a visitor looks at an obra: the strip in front of each one, as wide
// as the obra and two meters deep.
const VIEW_DEPTH = 2
function inFrontOfAnObra(template: ClubGalleryTemplateId, x: number, z: number, radius: number) {
  return clubGallerySlots[template].some((slot) => {
    const yaw = slot.rotation[1]
    const out = [Math.sin(yaw), Math.cos(yaw)]
    const side = [Math.cos(yaw), -Math.sin(yaw)]
    const dx = x - slot.position[0]
    const dz = z - slot.position[2]
    const depth = dx * out[0] + dz * out[1]
    const lateral = dx * side[0] + dz * side[1]
    return depth > -radius && depth < VIEW_DEPTH + radius && Math.abs(lateral) < slot.width / 2 + radius
  })
}

describe('Club room furniture', () => {
  for (const id of Object.keys(clubGalleryTemplates) as ClubGalleryTemplateId[]) {
    it(`keeps the board and the host out of every obra's view in the ${id} room`, () => {
      const template = clubGalleryTemplates[id]
      const board = clubBoardFrame(template)!
      expect(inFrontOfAnObra(id, board.center[0], board.center[1], board.width / 2), 'board').toBe(false)
      const host = clubHostSpot(template)!
      expect(inFrontOfAnObra(id, host.spot[0], host.spot[1], 0.35), 'host').toBe(false)
    })
  }
})
