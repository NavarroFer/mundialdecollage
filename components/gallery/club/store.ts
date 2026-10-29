import { create } from 'zustand'
import type { ClubHouse } from '@/lib/club-map'

// The Puerta al Club and the Club's map inside a gallery: every active
// gallery and the one the door leads to (picked by Game from the CDN list,
// lib/club-next-gallery.ts), whether the visitor is looking at the door from
// close enough to go through, and whether the map is open.
export const useClubDoorStore = create<{
  next: ClubHouse | null
  galleries: ClubHouse[]
  aiming: boolean
  mapOpen: boolean
  setNext: (next: ClubHouse | null) => void
  setGalleries: (galleries: ClubHouse[]) => void
  setAiming: (aiming: boolean) => void
  setMapOpen: (mapOpen: boolean) => void
}>((set) => ({
  next: null,
  galleries: [],
  aiming: false,
  mapOpen: false,
  setNext: (next) => set({ next }),
  setGalleries: (galleries) => set({ galleries }),
  setAiming: (aiming) => set({ aiming }),
  setMapOpen: (mapOpen) => set({ mapOpen }),
}))

/** Goes to another Club gallery: a full page load, so the next room starts clean. */
export function goToClubGallery(slug: string) {
  // A soft navigation would keep this room's WebGL context, physics and
  // presence channel alive under the next one.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/club/${encodeURIComponent(slug)}`)
}

/** Walks through the door to the gallery it names. */
export function goThroughClubDoor() {
  const { next } = useClubDoorStore.getState()
  if (next) goToClubGallery(next.slug)
}
