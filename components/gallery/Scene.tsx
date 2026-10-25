'use client'

import { VinylConsole } from './vinyl/VinylConsole'
import { ArcadeCabinet } from './arcade/ArcadeCabinet'
import { PointNavigation } from './navigation/PointNavigation'
import { AttentionRay } from './attention/AttentionRay'
import { useEffect, useRef, useState } from 'react'
import { EnvironmentLight } from './graphics/EnvironmentLight'
import { GraphicsRuntime } from './graphics/GraphicsRuntime'
import { useGraphics } from './graphics/store'
import { PRESETS } from './graphics/quality'
import { Canvas, useFrame } from '@react-three/fiber'
import { KeyboardControls } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import type { Artwork } from '@/data/artworks'
import { EdgeLook } from './camera/EdgeLook'
import { FirstPersonCamera } from './camera/FirstPersonCamera'
import { InteractionManager } from './interaction/InteractionManager'
import { PlayerTracker } from './minimap/PlayerTracker'
import { TapHintTracker } from './mobile/TapHintTracker'
import { TouchLookController } from './mobile/TouchLookController'
import { Player } from './player/Player'
import { keyboardMap } from './player/controls'
import { SouvenirCapture } from './souvenir/SouvenirCapture'
import { CollageWall, WallAim } from './wall/CollageWall'
import { World } from './world/World'
import { galleryThemes, type GalleryTheme } from './themes'

export type SceneProps = {
  artworks: Artwork[]
  theme: GalleryTheme
  /** The visitor is walking: keys, joystick and look drags move them. */
  controlMode: 'point' | 'classic'
  active: boolean
  /** Nothing on screen needs to move (start screen, phone menu). */
  paused: boolean
  isTouchDevice: boolean
  /** Desktop's Pointer Lock element (Game's shell); null on touch. */
  lockTarget: HTMLElement | null
  wall: { title: string; subtitle: string; cyrillic: boolean }
  /** Called once, on the first frame, when everything the scene suspends on has loaded. */
  onReady: () => void
}

/**
 * Everything three.js, loaded only once the visitor taps ENTRAR (Game.tsx):
 * three, drei and Rapier's WebAssembly are most of the page's JavaScript, and
 * mounting them behind the start screen kept the GPU and the physics busy for
 * a scene nobody could see yet.
 */
export function Scene({ artworks, theme, active, controlMode, paused, isTouchDevice, lockTarget, wall, onReady }: SceneProps) {
  const quality = useGraphics((s) => s.current)
  const dpr = useGraphics((s) => s.dpr)
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const update = () => setVisible(!document.hidden)
    update()
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  return (
    <KeyboardControls map={keyboardMap}>
      <Canvas
        shadows={PRESETS[quality].shadows ? 'percentage' : false}
        dpr={dpr}
        // Paused, it only draws when something asks (a resize, the souvenir
        // photo), so the last frame stays put behind the overlay.
        frameloop={paused || !visible ? 'demand' : 'always'}
        style={{ width: '100%', height: '100%', background: galleryThemes[theme].canvas }}
      >
        <EnvironmentLight />
        <GraphicsRuntime active={active && !paused && visible} mobile={isTouchDevice} />
        <Physics paused={paused || !visible}>
          <World artworks={artworks} theme={theme} />
          <ArcadeCabinet active={active} />
          <VinylConsole active={active} />
          <Player active={active} artworks={artworks} />
        </Physics>
        {!isTouchDevice && controlMode === 'classic' && <FirstPersonCamera target={lockTarget} pointerSpeed={0.75} />}
        {!isTouchDevice && controlMode === 'point' && <EdgeLook active={active} />}
        <TouchLookController active={active} />
        <PointNavigation active={active} touch={isTouchDevice} pointerLock={!isTouchDevice && controlMode === 'classic'} artworks={artworks} garden={theme === 'garden'} />
        <InteractionManager artworks={artworks} />
        {isTouchDevice && <TapHintTracker artworks={artworks} />}
        <PlayerTracker />
        <AttentionRay active={active} />
        <SouvenirCapture />
        <WallAim />
        <CollageWall theme={theme} title={wall.title} subtitle={wall.subtitle} cyrillic={wall.cyrillic} />
        <FirstFrame onReady={onReady} />
      </Canvas>
    </KeyboardControls>
  )
}

// The Canvas suspends as one piece (Rapier's WebAssembly, the obras'
// textures), so its first frame means the gallery is there to see.
function FirstFrame({ onReady }: { onReady: () => void }) {
  const done = useRef(false)
  useFrame(() => {
    if (done.current) return
    done.current = true
    onReady()
  })
  return null
}
