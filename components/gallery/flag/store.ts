import { create } from 'zustand'
import { cellAt, type MosaicGrid } from '../world/mar/mosaic'

/** What the mosaic knows about an obra on the cloth: enough to show it and send the visitor to its page. */
export type FlagEntry = { slug?: string; title?: string; name?: string; countryCode?: string; imageUrl: string }

/** The cloth as drawn right now, registered by the flag so a click can be traced to its obra. */
export type FlagLayout = { entries: FlagEntry[]; grid: MosaicGrid; canvas: { width: number; height: number } }

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
