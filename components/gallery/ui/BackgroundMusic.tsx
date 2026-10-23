'use client'

import { applyAudioVolume, routeThroughGain, type VolumeRoute } from '../vinyl/audio'
import { TRACKS, musicController, skipTrack, useVinylStore } from '../vinyl/store'
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

const MUSIC_SRC = TRACKS[0].src

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
  // Set up the gain route on the first user gesture, before playback.
  const startedRef = useRef(false)
  const playAttempt = useRef(0)
  const checkedRef = useRef(false)
  const gainRef = useRef<VolumeRoute | null>(null)
  const muted = useGalleryPreferences((state) => state.muted)
  const volume = useGalleryPreferences((state) => state.volume)
  const { m } = useI18n()

  function applyVolume() {
    const audio = audioRef.current
    const { muted, volume } = useGalleryPreferences.getState()
    if (audio) applyAudioVolume(audio, gainRef.current, volume, muted)
  }

  function play() {
    const audio = audioRef.current
    if (!audio) return
    if (!checkedRef.current) {
      checkedRef.current = true
      gainRef.current = routeThroughGain(audio)
    }
    applyVolume()
    void gainRef.current?.context.resume().catch(() => {})
    const attempt = ++playAttempt.current
    useVinylStore.setState({ error: '', loading: true })
    audio.play().then(() => {
      if (attempt === playAttempt.current) useVinylStore.setState({ loading: false })
    }).catch((error: unknown) => {
      if (attempt === playAttempt.current && !(error instanceof DOMException && error.name === 'AbortError')) useVinylStore.setState({ loading: false, playing: false, error: 'No se pudo reproducir. Probá de nuevo o elegí otra canción.' })
    })
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
    applyVolume()
    if (level > 0) {
      void gainRef.current?.context.resume().catch(() => {})
      if (state.muted) play()
    }
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

  useEffect(() => {
    const audio = audioRef.current!
    const attempts = playAttempt
    const controller = {
      play: () => { startedRef.current = true; useGalleryPreferences.getState().update({ muted: false }); play() },
      pause: () => { ++playAttempt.current; audio.pause(); useVinylStore.setState({ playing: false, loading: false }) },
      stop: () => { ++playAttempt.current; audio.pause(); audio.currentTime = 0; useVinylStore.setState({ playing: false, loading: false, time: 0 }) },
      select: (index: number) => {
        if (!TRACKS[index]) return
        ++playAttempt.current
        audio.pause()
        audio.src = TRACKS[index].src
        audio.load()
        useVinylStore.setState({ index, time: 0, duration: 0, playing: false, error: '' })
        controller.play()
      },
      setVolume: (level: number) => setLevel(level, true),
      seek: (time: number) => { if (Number.isFinite(audio.duration)) audio.currentTime = Math.max(0, Math.min(time, audio.duration)) },
    }
    musicController.current = controller
    return () => { if (musicController.current === controller) musicController.current = null; ++attempts.current; audio.pause() }
    // Controller methods read current refs/stores, and run in the user's gesture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(ref, () => ({ play: () => {
    if (startedRef.current) return
    startedRef.current = true
    play()
  } }))

  return (
    <>
      <audio ref={audioRef} src={MUSIC_SRC} preload="metadata" muted={muted}
        onPlaying={() => useVinylStore.setState({ playing: true, loading: false, error: '' })}
        onPause={() => useVinylStore.setState({ playing: false })}
        onWaiting={() => useVinylStore.setState({ loading: true })}
        onTimeUpdate={(event) => useVinylStore.setState({ time: event.currentTarget.currentTime })}
        onLoadedMetadata={(event) => useVinylStore.setState({ duration: Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0 })}
        onError={() => useVinylStore.setState({ playing: false, loading: false, error: 'No se pudo cargar esta canción. Elegí otra o reintentá.' })}
        onEnded={() => skipTrack(1)} />
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
