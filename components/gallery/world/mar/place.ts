import type { Artwork } from '@/data/artworks'
import type { GalleryVenue } from '../../venue'
import { marGallerySlots } from './layout'

/**
 * The daily exhibition arrives already hung in the Collage World Cup rooms.
 * MAR reuses those same obras, on its own walls, and leaves the original
 * list untouched so switching back restores the other building.
 */
export function artworksForVenue(artworks: Artwork[], venue: GalleryVenue): Artwork[] {
  if (venue !== 'mar' || artworks.length === 0) return artworks
  const count = artworks.length
  return artworks.map((artwork, index) => {
    const spread = Math.floor((index * marGallerySlots.length) / count)
    const slot = marGallerySlots[Math.min(count >= marGallerySlots.length ? index : spread, marGallerySlots.length - 1)]
    return {
      ...artwork,
      roomId: slot.roomId,
      position: [slot.position[0], slot.position[1], slot.position[2]],
      rotation: [slot.rotation[0], slot.rotation[1], slot.rotation[2]],
      width: slot.width,
      height: slot.height,
    }
  })
}
