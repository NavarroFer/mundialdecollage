'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import type { GalleryTheme } from '../themes'
import styles from '../gallery-theme.module.css'
import { useGalleryPreferences } from '../preferences/store'
import { VolumeGauge } from './VolumeGauge'
import { useI18n } from '@/lib/i18n/client'

export type BackgroundMusicHandle = {
  /** Safe to call more than once — a no-op while already playing. */
  play: () => void
}

const MUSIC_SRC = '/cancion.mp3'

/** The tank's 1–100 as loudness, squared so its lower half isn't all whisper (the default 60 ≈ the 0.35 it always played at). */
const gainFor = (volume: number) => (volume / 100) ** 2

// iOS ignores `volume` on a media element (the phone's buttons own it): the
// value set doesn't stick. There the song goes through Web Audio instead,
// whose gain does obey.
function obeysVolume(audio: HTMLAudioElement) {
  const before = audio.volume
  audio.volume = before === 0.5 ? 0.25 : 0.5
  const obeyed = audio.volume !== before
  audio.volume = before
  return obeyed
}

function routeThroughGain(audio: HTMLAudioElement) {
  try {
    const context = new AudioContext()
    const gain = context.createGain()
    context.createMediaElementSource(audio).connect(gain).connect(context.destination)
    return { context, gain }
  } catch {
    return null
  }
}

/**
 * Ambient loop for the exhibition. play() is exposed imperatively so Game.tsx
 * can call it from inside the same click handler as "ENTRAR A LA
 * EXPOSICIÓN" — browsers only allow audio-with-sound to start from a call
 * stack that began with a real user gesture, and a useEffect reacting to
 * state set by that click runs too late for some of them to count it.
 * `showVolume` adds the tank under the button (VolumeGauge): it reads 0 while
 * muted, and dragging it turns the music back on.
 */
export const BackgroundMusic = forwardRef<BackgroundMusicHandle, { theme: GalleryTheme; inline?: boolean; showVolume?: boolean }>(function BackgroundMusic({ theme: _theme, inline = false, showVolume = false }, ref) {
  const audioRef = useRef<HTMLAudioElement>(null)
  // Only on iOS (obeysVolume), set up on the first play(), before a note has
  // sounded: an AudioContext only starts inside a user gesture.
  const checkedRef = useRef(false)
  const gainRef = useRef<{ context: AudioContext; gain: GainNode } | null>(null)
  const muted = useGalleryPreferences((state) => state.muted)
  const volume = useGalleryPreferences((state) => state.volume)
  const { m } = useI18n()

  function applyVolume() {
    const audio = audioRef.current
    const { muted, volume } = useGalleryPreferences.getState()
    // `volume` isn't a real HTML attribute (React's audio/video typings don't
    // expose it as a prop) — it only exists as a DOM property.
    if (audio) audio.volume = gainFor(volume)
    // Eased, or each step of a drag clicks.
    const routed = gainRef.current
    routed?.gain.gain.setTargetAtTime(muted ? 0 : gainFor(volume), routed.context.currentTime, 0.02)
  }

  function play() {
    const audio = audioRef.current
    if (!audio) return
    if (!checkedRef.current) {
      checkedRef.current = true
      if (!obeysVolume(audio)) gainRef.current = routeThroughGain(audio)
      applyVolume()
    }
    void gainRef.current?.context.resume().catch(() => {})
    audio.play().catch(() => {})
  }

  function toggle() {
    const state = useGalleryPreferences.getState()
    state.update({ muted: !state.muted })
    if (state.muted) play()
  }

  // The tank down to 0 is the mute, so turning the music back on always
  // sounds; raising it unmutes. `save` once the drag is let go.
  function setLevel(level: number, save: boolean) {
    const state = useGalleryPreferences.getState()
    const patch = level === 0 ? { muted: true } : { volume: level, muted: false }
    if (save) state.update(patch)
    else useGalleryPreferences.setState(patch)
    if (state.muted && level > 0) play()
  }

  // Again whenever either changes; applyVolume reads them from the store.
  useEffect(applyVolume, [volume, muted])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'KeyM' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target
      if (target instanceof HTMLElement && (target.closest('input, textarea, select') || target.isContentEditable)) return
      event.preventDefault()
      toggle()
    }
    // Back from another app, iOS leaves the Web Audio route stopped.
    const wake = () => {
      if (document.visibilityState === 'visible') void gainRef.current?.context.resume().catch(() => {})
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('visibilitychange', wake)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', wake)
    }
    // toggle only reads the store and refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => void gainRef.current?.context.close().catch(() => {}), [])

  useImperativeHandle(ref, () => ({ play }))

  return (
    <>
      <audio ref={audioRef} src={MUSIC_SRC} loop preload="auto" muted={muted} />
      <button
        type="button"
        onClick={toggle}
        aria-keyshortcuts="M"
        title={`${muted ? m.gallery.musicOn : m.gallery.musicOff} (M)`}
        aria-label={muted ? m.gallery.musicOn : m.gallery.musicOff}
        className={`${styles.hudButton} animate-in fade-in pointer-events-auto relative z-40 flex min-h-11 min-w-11 gap-2 px-3 items-center justify-center duration-300 transition-transform hover:scale-105`}
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        <span>{muted ? m.gallery.musicOn : m.gallery.musicOff}{!inline && " · M"}</span>
      </button>
      {showVolume && <VolumeGauge value={muted ? 0 : volume} onInput={(level) => setLevel(level, false)} onChange={(level) => setLevel(level, true)} label={m.gallery.volume} />}
    </>
  )
})
