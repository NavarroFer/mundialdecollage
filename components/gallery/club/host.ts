import { create } from 'zustand'
import type { ClubContact } from '@/lib/club-contact'

/** Who receives visitors in a Club room, and what their welcome letter says. */
export type ClubHostInfo = {
  /** A Rocketbox avatar of the cast (people/cast.ts), chosen by the member. */
  avatarId: string
  artistName: string
  title: string
  statement?: string
  contact?: ClubContact
}

// Whether the visitor is looking at the host from close by, and whether the
// welcome letter is open.
export const useClubHostStore = create<{
  aiming: boolean
  open: boolean
  setAiming: (aiming: boolean) => void
  setOpen: (open: boolean) => void
}>((set) => ({
  aiming: false,
  open: false,
  setAiming: (aiming) => set({ aiming }),
  setOpen: (open) => set({ open }),
}))
