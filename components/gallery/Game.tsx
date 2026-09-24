'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Canvas } from '@react-three/fiber'
import { KeyboardControls } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import type { Artwork } from '@/data/artworks'
import { FloatingReactions } from './artwork/FloatingReactions'
import { FirstPersonCamera, type FirstPersonCameraHandle } from './camera/FirstPersonCamera'
import { InteractionManager } from './interaction/InteractionManager'
import { PlayerTracker } from './minimap/PlayerTracker'
import { GalleryPresence } from './presence/GalleryPresence'
import { TouchControls } from './mobile/TouchControls'
import { TouchLookController } from './mobile/TouchLookController'
import { Player } from './player/Player'
import { keyboardMap } from './player/controls'
import { ArtworkModal } from './ui/ArtworkModal'
import { BackgroundMusic, type BackgroundMusicHandle } from './ui/BackgroundMusic'
import { InteractionPrompt } from './ui/InteractionPrompt'
import { Minimap } from './ui/Minimap'
import { PresenceCounter } from './ui/PresenceCounter'
import { StartScreen } from './ui/StartScreen'
import { ThemePicker } from './ui/ThemePicker'
import { useInteractionStore } from './interaction/store'
import { World } from './world/World'
import { galleryThemes, type GalleryTheme } from './themes'
import styles from './gallery-theme.module.css'
import { cn } from '@/lib/utils'

// Doesn't change over a session, so no subscription is needed — just a
// client-only snapshot read via useSyncExternalStore (SSR-safe, and no
// effect+setState render cascade the way a useEffect check would cause).
const noopSubscribe = () => () => {}
const getIsTouchDevice = () => window.matchMedia('(pointer: coarse)').matches
const getServerSnapshot = () => false

export function Game({ artworks }: { artworks: Artwork[] }) {
  const isTouchDevice = useSyncExternalStore(noopSubscribe, getIsTouchDevice, getServerSnapshot)
  const [locked, setLocked] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [theme, setTheme] = useState<GalleryTheme>('collage')
  const openId = useInteractionStore((state) => state.openId)
  const musicRef = useRef<BackgroundMusicHandle>(null)
  const controlsRef = useRef<FirstPersonCameraHandle>(null)
  const [resuming, setResuming] = useState(false)

  // Desktop has no concept of "started but not locked" — Pointer Lock IS
  // the active state. Touch has no Pointer Lock at all, so tapping ENTRAR
  // is the whole activation.
  const isActive = isTouchDevice ? hasStarted : locked

  // Reading an obra shouldn't feel like pausing. The modal needs the cursor,
  // so opening it releases Pointer Lock; closing it with E, the × or a click
  // outside is a user gesture, which lets us take the lock straight back
  // before the pause screen can show. Escape isn't one the browser accepts
  // for that, so it still lands on "Click para continuar".
  useEffect(() => {
    if (isTouchDevice) return
    let resumeOnClose = false
    const stopResuming = () => setResuming(false)
    document.addEventListener('pointerlockerror', stopResuming)
    const unsubscribe = useInteractionStore.subscribe((state, previous) => {
      if (state.openId && !previous.openId) {
        resumeOnClose = document.pointerLockElement !== null
        if (resumeOnClose) document.exitPointerLock()
        return
      }
      if (state.openId || !previous.openId || !resumeOnClose) return
      resumeOnClose = false
      const element = controlsRef.current?.domElement
      if (!element || navigator.userActivation?.isActive === false) return
      setResuming(true)
      // Chrome returns a promise here; Safari/Firefox return nothing and only fire pointerlockerror.
      Promise.resolve(element.requestPointerLock()).catch(stopResuming)
    })
    return () => {
      unsubscribe()
      document.removeEventListener('pointerlockerror', stopResuming)
    }
  }, [isTouchDevice])

  function handleEnter() {
    setHasStarted(true)
    musicRef.current?.play()
  }

  return (
    <div className={cn(styles.shell, theme === 'windows98' && styles.windows98, theme === 'collage' && styles.collage, theme === 'garden' && styles.garden)}>
      <KeyboardControls map={keyboardMap}>
        <Canvas
          shadows="variance"
          // R3F's Canvas hardcodes the container div to width/height 100% and
          // merges any `style` prop on top — a `className` can't win against
          // that inline style, so the viewport-relative height has to go here.
          style={{ width: '100%', height: '100dvh', background: galleryThemes[theme].canvas }}
        >
          <Physics>
            <World artworks={artworks} theme={theme} />
            <Player active={isActive} artworks={artworks} />
          </Physics>
          {!isTouchDevice && (
            <FirstPersonCamera
              ref={controlsRef}
              selector="#gallery-enter-button"
              pointerSpeed={0.75}
              onLock={() => {
                setLocked(true)
                setResuming(false)
              }}
              onUnlock={() => setLocked(false)}
            />
          )}
          <TouchLookController active={isActive} />
          <InteractionManager artworks={artworks} />
          <PlayerTracker />
          <FloatingReactions artworks={artworks} />
        </Canvas>
      </KeyboardControls>
      <GalleryPresence inside={hasStarted} artworks={artworks} />
      {isTouchDevice && isActive && !openId && <TouchControls theme={theme} />}
      <BackgroundMusic ref={musicRef} theme={theme} />
      <Minimap theme={theme} artworks={artworks} />
      {hasStarted && <PresenceCounter />}
      <InteractionPrompt theme={theme} />
      <ArtworkModal artworks={artworks} theme={theme} />
      {!openId && <ThemePicker theme={theme} onChange={setTheme} />}
      {!isActive && !openId && !resuming && (
        <StartScreen
          label={hasStarted ? 'Click para continuar' : 'ENTRAR A LA EXPOSICIÓN'}
          showPresence={!hasStarted}
          hint={
            isTouchDevice
              ? 'Joystick para moverte · Arrastrá para mirar · Botón E para ver una obra'
              : 'WASD para moverte · Shift para correr · Mantené Control (Ctrl) para agacharte · Mouse para mirar · E para ver una obra'
          }
          onEnter={handleEnter}
        />
      )}
    </div>
  )
}
