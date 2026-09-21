'use client'

import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { KeyboardControls } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { FirstPersonCamera } from './camera/FirstPersonCamera'
import { Player } from './player/Player'
import { keyboardMap } from './player/controls'
import { StartScreen } from './ui/StartScreen'
import { World } from './world/World'

export function Game() {
  const [locked, setLocked] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)

  return (
    <div className="relative">
      <KeyboardControls map={keyboardMap}>
        <Canvas
          shadows="percentage"
          // R3F's Canvas hardcodes the container div to width/height 100% and
          // merges any `style` prop on top — a `className` can't win against
          // that inline style, so the viewport-relative height has to go here.
          style={{ width: '100%', height: '100dvh' }}
          className="bg-[#e9e6dd]"
        >
          <Physics>
            <World />
            <Player active={locked} />
          </Physics>
          <FirstPersonCamera
            selector="#gallery-enter-button"
            onLock={() => setLocked(true)}
            onUnlock={() => setLocked(false)}
          />
        </Canvas>
      </KeyboardControls>
      {!locked && (
        <StartScreen
          label={hasStarted ? 'Click para continuar' : 'ENTRAR A LA EXPOSICIÓN'}
          onEnter={() => setHasStarted(true)}
        />
      )}
    </div>
  )
}
