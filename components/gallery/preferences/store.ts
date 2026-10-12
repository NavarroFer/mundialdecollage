import { create } from 'zustand'
import { GALLERY_THEMES, type GalleryTheme } from '../themes'

const KEY = 'mdc-gallery-preferences-v1'
/** Walking by clicks or taps on the floor, or with keys / joystick. */
export type ControlMode = 'point' | 'classic'
export type Preferences = { controlMode: ControlMode; theme: GalleryTheme; muted: boolean; sensitivity: number; visited: string[]; lastArtwork: string | null }
const defaults: Preferences = { controlMode: 'point', theme: 'collage', muted: false, sensitivity: 1, visited: [], lastArtwork: null }

export function parsePreferences(raw: string | null): Preferences {
  try {
    const value = JSON.parse(raw ?? '{}') ?? {}
    return {
      controlMode: value.controlMode === 'classic' ? 'classic' : 'point',
      theme: GALLERY_THEMES.includes(value.theme) ? value.theme : defaults.theme,
      muted: value.muted === true,
      sensitivity: [0.5, 1, 1.5].includes(value.sensitivity) ? value.sensitivity : 1,
      visited: Array.isArray(value.visited) ? [...new Set<string>(value.visited.filter((id: unknown) => typeof id === 'string' && id.length < 200))].slice(-500) : [],
      lastArtwork: typeof value.lastArtwork === 'string' && value.lastArtwork.length < 200 ? value.lastArtwork : null,
    }
  } catch { return { ...defaults } }
}

type State = Preferences & {
  resumeArtwork: string | null
  hydrate: () => void
  update: (patch: Partial<Preferences>) => void
  visit: (id: string) => void
}
export const useGalleryPreferences = create<State>((set, get) => ({
  ...defaults,
  resumeArtwork: null,
  hydrate: () => {
    try { set(parsePreferences(localStorage.getItem(KEY))) } catch {}
  },
  update: (patch) => {
    set(patch)
    const { theme, muted, sensitivity, visited, lastArtwork, controlMode } = get()
    try { localStorage.setItem(KEY, JSON.stringify({ theme, muted, sensitivity, visited, lastArtwork, controlMode })) } catch {}
  },
  visit: (id) => {
    const state = get()
    if (state.lastArtwork === id && state.visited.includes(id)) return
    state.update({ visited: [...state.visited.filter((value) => value !== id), id].slice(-500), lastArtwork: id })
  },
}))
