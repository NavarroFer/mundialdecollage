import { create } from 'zustand'
import { getWall } from '@/app/[locale]/(site)/galeria-3d/wall-actions'
import { WALL_FRAME, type WallFrame, type WallLives, type WallPiece, type WallPoint } from '@/lib/collage-wall'

// Where the crosshair meets the frame, updated every frame by WallAim —
// kept out of React so the ghost can follow it without re-rendering
// anything; the store only flips `aiming` when it appears or goes.
export const currentAim: { point: WallPoint | null } = { point: null }

type WallStore = {
  /** Where the frame is: the museum's collage unless a Club gallery set its board. */
  frame: WallFrame
  /** The Club gallery whose board this is (its slug); null for the museum's collage. */
  board: string | null
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
  frame: WALL_FRAME,
  board: null,
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

/** In a Club gallery, its board instead of the museum's collage; call before loadWall. */
export function showClubBoard(frame: WallFrame, board: string) {
  useWallStore.setState({ frame, board, pieces: [], loaded: false })
}

/** This week's collage (or the Club board's pieces); a failure leaves the frame empty rather than breaking the gallery. */
export async function loadWall() {
  try {
    const result = await getWall(useWallStore.getState().board)
    if ('error' in result) {
      useWallStore.setState({ loaded: true, available: false })
      return
    }
    useWallStore.setState({ pieces: result.pieces, lives: result.lives, userId: result.userId, weekStart: result.weekStart, loaded: true, available: true })
  } catch {
    useWallStore.setState({ loaded: true, available: false })
  }
}
