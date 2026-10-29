import { create } from 'zustand'
import type { ClubHouse } from '@/lib/club-map'

// The Puerta al Club: which gallery it leads to (picked by Game from the
// CDN list, lib/club-next-gallery.ts) and whether the visitor is looking at
// it from close enough to go through.
export const useClubDoorStore = create<{
  next: ClubHouse | null
  aiming: boolean
  setNext: (next: ClubHouse | null) => void
  setAiming: (aiming: boolean) => void
}>((set) => ({
  next: null,
  aiming: false,
  setNext: (next) => set({ next }),
  setAiming: (aiming) => set({ aiming }),
}))

/** Walks through the door: a full page load, so the next room starts clean. */
export function goThroughClubDoor() {
  const { next } = useClubDoorStore.getState()
  // A soft navigation would keep this room's WebGL context, physics and
  // presence channel alive under the next one.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  if (next) window.location.assign(`/club/${encodeURIComponent(next.slug)}`)
}
