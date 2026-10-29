import type { WallFrame } from '@/lib/collage-wall'
import type { GalleryRoomTemplate } from '../world/roomsData'

/**
 * Where a Club room's kraft board stands: on legs in the corner to the left
 * of the way in, turned toward the middle of the room. The corner is the one
 * spot no obra hangs in front of (data/artworks.ts spreads them along each
 * wall). Null for a room without a way in along x.
 */
export function clubBoardFrame(template: GalleryRoomTemplate): WallFrame | null {
  const entrance = template.doorways[0]
  if (!entrance || entrance.axis !== 'x') return null
  const inward = entrance.center[2] > (template.bounds[1] + template.bounds[3]) / 2 ? -1 : 1
  const bottom = 0.6
  const height = 1.0
  return {
    center: [template.bounds[0] + 0.85, entrance.center[2] + inward * 0.85],
    yaw: inward < 0 ? (3 * Math.PI) / 4 : Math.PI / 4,
    width: 1.2,
    bottom,
    height,
    piece: 0.3,
    plaqueY: bottom + height + 0.24,
    freestanding: true,
  }
}
