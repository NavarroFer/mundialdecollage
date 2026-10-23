import { create } from 'zustand'
import classics from './tracks.json'

// Room 1: west face of the divider, in the gap beside the doorway and
// before the artwork. Footprint includes the quarter-turn toward the room.
export const VINYL = { x: -8.68, z: 0, width: 0.8, depth: 1.05, rotation: -Math.PI / 2, approach: { x: -10.38, z: 0 } }
export const TRACKS = [{ id: 'mundial', title: 'La canción del Mundial', composer: 'Mundial de Collage', performer: '', src: '/cancion.mp3', source: '', license: '' }, ...classics]
export function adjacentTrack(index: number, delta: number, shuffle = false, random = Math.random) {
  const count = TRACKS.length
  return shuffle ? (index + 1 + Math.floor(random() * (count - 1))) % count : (index + delta + count) % count
}
export type MusicController = { play: () => void; pause: () => void; stop: () => void; select: (index: number) => void; seek: (time: number) => void; setVolume: (level: number) => void }
export const musicController: { current: MusicController | null } = { current: null }
export const useVinylStore = create<{
  open: boolean; aiming: boolean; index: number; playing: boolean; shuffle: boolean; time: number; duration: number; error: string; loading: boolean
  setOpen: (open: boolean) => void
}>((set) => ({ open: false, aiming: false, index: 0, playing: false, shuffle: false, time: 0, duration: 0, error: '', loading: false, setOpen: (open) => set({ open }) }))
export function skipTrack(delta: number) {
  const { index, shuffle } = useVinylStore.getState()
  musicController.current?.select(adjacentTrack(index, delta, shuffle))
}
