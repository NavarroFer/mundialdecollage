'use client'

import { useRef, useState, useSyncExternalStore } from 'react'
import { Canvas } from '@react-three/fiber'
import { KeyboardControls } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import type { Artwork } from '@/data/artworks'
import { FirstPersonCamera } from './camera/FirstPersonCamera'
import { InteractionManager } from './interaction/InteractionManager'
import { PlayerTracker } from './minimap/PlayerTracker'
import { TouchControls } from './mobile/TouchControls'
import { TouchLookController } from './mobile/TouchLookController'
import { Player } from './player/Player'
import { keyboardMap } from './player/controls'
import { ArtworkModal } from './ui/ArtworkModal'
import { BackgroundMusic, type BackgroundMusicHandle } from './ui/BackgroundMusic'
import { InteractionPrompt } from './ui/InteractionPrompt'
import { Minimap } from './ui/Minimap'
import { StartScreen } from './ui/StartScreen'
import { World } from './world/World'

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
  const musicRef = useRef<BackgroundMusicHandle>(null)

  // Desktop has no concept of "started but not locked" — Pointer Lock IS
  // the active state. Touch has no Pointer Lock at all, so tapping ENTRAR
  // is the whole activation.
  const isActive = isTouchDevice ? hasStarted : locked

  function handleEnter() {
    setHasStarted(true)
    musicRef.current?.play()
  }

  return (
    <div className="relative">
      <KeyboardControls map={keyboardMap}>
        <Canvas
          shadows="variance"
          // R3F's Canvas hardcodes the container div to width/height 100% and
          // merges any `style` prop on top — a `className` can't win against
          // that inline style, so the viewport-relative height has to go here.
          style={{ width: '100%', height: '100dvh' }}
          className="bg-[#e9e6dd]"
        >
          <Physics>
            <World artworks={artworks} />
            <Player active={isActive} />
          </Physics>
          {!isTouchDevice && (
            <FirstPersonCamera
              selector="#gallery-enter-button"
              pointerSpeed={0.75}
              onLock={() => setLocked(true)}
              onUnlock={() => setLocked(false)}
            />
          )}
          <TouchLookController active={isActive} />
          <InteractionManager artworks={artworks} />
          <PlayerTracker />
        </Canvas>
      </KeyboardControls>
      {isTouchDevice && isActive && <TouchControls />}
      <BackgroundMusic ref={musicRef} />
      <Minimap />
      <InteractionPrompt />
      <ArtworkModal artworks={artworks} />
      {!isActive && (
        <StartScreen
          label={hasStarted ? 'Click para continuar' : 'ENTRAR A LA EXPOSICIÓN'}
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
