import type { WallFrame } from '@/lib/collage-wall'
import type { ClubGalleryTemplateId, GalleryRoomTemplate } from '../world/roomsData'

// Where each Club room's kraft board stands, on legs, chosen where no obra
// hangs in front (placement.test.ts checks it against every slot): the
// cabinet's corner left of the way in, turned toward the room, and the
// bigger rooms' entrance wall, which holds no obras, facing the room.
const BOARDS: Record<ClubGalleryTemplateId, Pick<WallFrame, 'center' | 'yaw' | 'width'>> = {
  cabinet: { center: [-4.4, 3.4], yaw: (3 * Math.PI) / 4, width: 1 },
  classic: { center: [-3.6, 4.3], yaw: Math.PI, width: 1.4 },
  double: { center: [-3.6, 4.3], yaw: Math.PI, width: 1.4 },
}

/** The board of a Club room; null for the museum. */
export function clubBoardFrame(template: GalleryRoomTemplate): WallFrame | null {
  if (template.id === 'main') return null
  const bottom = 0.6
  const height = 1.0
  return {
    ...BOARDS[template.id],
    bottom,
    height,
    piece: 0.3,
    plaqueY: bottom + height + 0.24,
    freestanding: true,
  }
}
