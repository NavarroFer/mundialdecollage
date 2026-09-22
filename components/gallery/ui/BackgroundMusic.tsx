'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import type { GalleryTheme } from '../themes'
import styles from '../gallery-theme.module.css'

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
export const BackgroundMusic = forwardRef<BackgroundMusicHandle, { theme: GalleryTheme }>(function BackgroundMusic({ theme: _theme }, ref) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [muted, setMuted] = useState(false)

  // `volume` isn't a real HTML attribute (React's audio/video typings don't
  // expose it as a prop) — it only exists as a DOM property, set here once.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = DEFAULT_VOLUME
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
        onClick={() => setMuted((prev) => !prev)}
        aria-label={muted ? 'Activar música' : 'Silenciar música'}
        className={`${styles.hudButton} animate-in fade-in absolute top-4 left-4 z-20 flex h-10 w-10 items-center justify-center duration-300 transition-transform hover:scale-105`}
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>
    </>
  )
})
