'use client'

import { PointNavigation } from './navigation/PointNavigation'
import { AttentionRay } from './attention/AttentionRay'
import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { KeyboardControls } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import type { Artwork } from '@/data/artworks'
import { FloatingReactions } from './artwork/FloatingReactions'
import { EdgeLook } from './camera/EdgeLook'
import { FirstPersonCamera } from './camera/FirstPersonCamera'
import { InteractionManager } from './interaction/InteractionManager'
import { PlayerTracker } from './minimap/PlayerTracker'
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
  return (
    <KeyboardControls map={keyboardMap}>
      <Canvas
        // Phones get no shadow maps and at most 1.5× pixels: a 3× screen
        // otherwise draws over twice the pixels of 2× for a difference
        // nobody sees at arm's length.
        shadows={isTouchDevice ? false : 'variance'}
        dpr={isTouchDevice ? [1, 1.5] : [1, 2]}
        // Paused, it only draws when something asks (a resize, the souvenir
        // photo), so the last frame stays put behind the overlay.
        frameloop={paused ? 'demand' : 'always'}
        style={{ width: '100%', height: '100%', background: galleryThemes[theme].canvas }}
      >
        <Physics paused={paused}>
          <World artworks={artworks} theme={theme} />
          <Player active={active} artworks={artworks} />
        </Physics>
        {!isTouchDevice && controlMode === 'classic' && <FirstPersonCamera target={lockTarget} pointerSpeed={0.75} />}
        {!isTouchDevice && controlMode === 'point' && <EdgeLook active={active} />}
        <TouchLookController active={active} />
        <PointNavigation active={active} touch={isTouchDevice} pointerLock={!isTouchDevice && controlMode === 'classic'} artworks={artworks} garden={theme === 'garden'} />
        <InteractionManager artworks={artworks} />
        <PlayerTracker />
        <AttentionRay active={active} />
        <FloatingReactions artworks={artworks} />
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
