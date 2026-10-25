'use client'
import { create } from 'zustand'
import { initialQuality, parseGraphics, type Capabilities, type Quality, type Selection } from './quality'
const KEY = 'mdc-gallery-graphics-v1'
type State = {
  dpr: number; selection: Selection; adaptive: boolean; current: Quality; detected: Quality; mobile: boolean; fps: number | null; hydrated: boolean
  hydrate: () => void
  detect: (caps: Capabilities) => void
  configure: (selection: Selection, adaptive: boolean) => void
}
export const useGraphics = create<State>((set, get) => ({
  dpr: 1, selection: 'auto', adaptive: true, current: 'medium', detected: 'medium', mobile: false, fps: null, hydrated: false,
  hydrate: () => {
    if (get().hydrated) return
    let saved = parseGraphics(null)
    try { saved = parseGraphics(localStorage.getItem(KEY)) } catch {}
    set({ ...saved, hydrated: true, current: saved.selection === 'auto' ? get().detected : saved.selection })
  },
  detect: (caps) => {
    const detected = initialQuality(caps)
    set({ detected, mobile: caps.mobile, current: get().selection === 'auto' ? detected : get().selection as Quality })
  },
  configure: (selection, adaptive) => {
    set({ selection, adaptive, current: selection === 'auto' ? get().detected : selection, fps: null })
    try { localStorage.setItem(KEY, JSON.stringify({ selection, adaptive })) } catch {}
  },
}))
