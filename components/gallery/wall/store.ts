import { create } from 'zustand'
import { getWall } from '@/app/[locale]/(site)/galeria-3d/wall-actions'
import type { WallLives, WallPiece, WallPoint } from '@/lib/collage-wall'

// Where the crosshair meets the frame, updated every frame by WallAim —
// kept out of React so the ghost can follow it without re-rendering
// anything; the store only flips `aiming` when it appears or goes.
export const currentAim: { point: WallPoint | null } = { point: null }

type WallStore = {
  pieces: WallPiece[]
  /** Null while signed out (or before the collage loads). */
  lives: WallLives | null
  userId: string | null
  weekStart: string | null
  loaded: boolean
  /** False once loading failed: the dialog says so instead of offering to paste. */
  available: boolean
  aiming: boolean
  /** The spot being pasted on while the dialog is open. */
  placing: WallPoint | null
  setAiming: (aiming: boolean) => void
  open: (point: WallPoint) => void
  close: () => void
  added: (piece: WallPiece, lives: WallLives) => void
  setLives: (lives: WallLives) => void
}

export const useWallStore = create<WallStore>((set, get) => ({
  pieces: [],
  lives: null,
  userId: null,
  weekStart: null,
  loaded: false,
  available: true,
  aiming: false,
  placing: null,
  setAiming: (aiming) => {
    if (get().aiming !== aiming) set({ aiming })
  },
  open: (point) => set({ placing: point }),
  close: () => set({ placing: null }),
  added: (piece, lives) => set((state) => ({ pieces: [...state.pieces, piece], lives })),
  setLives: (lives) => set({ lives }),
}))

/** This week's collage; a failure leaves the frame empty rather than breaking the gallery. */
export async function loadWall() {
  try {
    const result = await getWall()
    if ('error' in result) {
      useWallStore.setState({ loaded: true, available: false })
      return
    }
    useWallStore.setState({ pieces: result.pieces, lives: result.lives, userId: result.userId, weekStart: result.weekStart, loaded: true, available: true })
  } catch {
    useWallStore.setState({ loaded: true, available: false })
  }
}
