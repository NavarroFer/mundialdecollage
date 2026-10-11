'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import type { GalleryTheme } from '../themes'
import styles from '../gallery-theme.module.css'
import { useGalleryPreferences } from '../preferences/store'
import { useI18n } from '@/lib/i18n/client'

export type BackgroundMusicHandle = {
  /** Safe to call more than once — a no-op while already playing. */
  play: () => void
}

const MUSIC_SRC = '/cancion.mp3'
const DEFAULT_VOLUME = 0.35

/**
 * Ambient loop for the exhibition. play() is exposed imperatively so Game.tsx
 * can call it from inside the same click handler as "ENTRAR A LA
 * EXPOSICIÓN" — browsers only allow audio-with-sound to start from a call
 * stack that began with a real user gesture, and a useEffect reacting to
 * state set by that click runs too late for some of them to count it.
 */
export const BackgroundMusic = forwardRef<BackgroundMusicHandle, { theme: GalleryTheme; inline?: boolean }>(function BackgroundMusic({ theme: _theme, inline = false }, ref) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const muted = useGalleryPreferences((state) => state.muted)
  const toggle = () => {
    const state = useGalleryPreferences.getState()
    state.update({ muted: !state.muted })
    if (state.muted) void audioRef.current?.play().catch(() => {})
  }
  const { m } = useI18n()

  // `volume` isn't a real HTML attribute (React's audio/video typings don't
  // expose it as a prop) — it only exists as a DOM property, set here once.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = DEFAULT_VOLUME
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'KeyM' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target
      if (target instanceof HTMLElement && (target.closest('input, textarea, select') || target.isContentEditable)) return
      event.preventDefault()
      const state = useGalleryPreferences.getState()
      state.update({ muted: !state.muted })
      if (state.muted) void audioRef.current?.play().catch(() => {})
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useImperativeHandle(ref, () => ({
    play: () => {
      audioRef.current?.play().catch(() => {})
    },
  }))

  return (
    <>
      <audio ref={audioRef} src={MUSIC_SRC} loop preload="auto" muted={muted} />
      <button
        type="button"
        onClick={toggle}
        aria-keyshortcuts="M"
        title={`${muted ? m.gallery.musicOn : m.gallery.musicOff} (M)`}
        aria-label={muted ? m.gallery.musicOn : m.gallery.musicOff}
        className={`${styles.hudButton} animate-in fade-in absolute top-4 ${inline ? 'right-4' : 'left-4'} z-40 flex min-h-11 min-w-11 gap-2 px-3 items-center justify-center duration-300 transition-transform hover:scale-105`}
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        <span>{muted ? m.gallery.musicOn : m.gallery.musicOff}{!inline && " · M"}</span>
      </button>
    </>
  )
})
