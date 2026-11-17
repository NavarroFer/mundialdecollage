import { create } from 'zustand'
import { cellAt, type MosaicGrid } from '../world/mar/mosaic'

/** What the mosaic knows about an obra on the cloth: enough to show it and send the visitor to its page. */
export type FlagEntry = { slug?: string; title?: string; name?: string; countryCode?: string; imageUrl: string }

/** The cloth as drawn right now, registered by the flag so a click can be traced to its obra. */
export type FlagLayout = { entries: FlagEntry[]; grid: MosaicGrid; canvas: { width: number; height: number } }

/** The flag hangs high, so it opens from further back than an obra (a click or E): its pictures are small. */
export const FLAG_REACH = 14

type FlagStore = {
  layout: FlagLayout | null
  /** The obra whose card is open. */
  entry: FlagEntry | null
  setLayout: (layout: FlagLayout | null) => void
  /** A click on the cloth at texture coordinates (u, v): opens the card of the obra there, if it has a page. */
  pick: (u: number, v: number) => boolean
  close: () => void
}

export const useFlagStore = create<FlagStore>((set, get) => ({
  layout: null,
  entry: null,
  setLayout: (layout) => set({ layout }),
  pick: (u, v) => {
    const layout = get().layout
    if (!layout) return false
    const index = cellAt(u, v, layout.grid, layout.canvas, layout.entries.length)
    const entry = index === null ? undefined : layout.entries[index]
    // The day's own obras fill the cloth before the full list arrives; they have no page to go to.
    if (!entry?.slug) return false
    set({ entry })
    return true
  },
  close: () => set({ entry: null }),
}))

/** The cloth has obras a click can open: the full list has arrived, not just the day's pictures. */
export const flagPickable = (layout: FlagLayout | null) => Boolean(layout?.entries.some((entry) => entry.slug))

/**
 * Where E points on the cloth, as texture coordinates, or null when it isn't
 * on it. Asked only when the key is pressed; FlagTracker, inside the Canvas,
 * answers it from the scene.
 */
export const flagAim: { current: (() => { u: number; v: number } | null) | null } = { current: null }

/** E on the cloth: opens the obra it points at. False when it points elsewhere, so E does what it would have. */
export function pickAimedObra() {
  const at = flagAim.current?.()
  return at ? useFlagStore.getState().pick(at.u, at.v) : false
}

/**
 * The floating hand that tells a visitor near the flag that its pictures
 * open: where it goes on screen, in pixels from the canvas's top left, or
 * null while it's off. Its own store, since it moves every frame.
 */
export const useFlagHintStore = create<{ spot: { x: number; y: number } | null }>(() => ({ spot: null }))
