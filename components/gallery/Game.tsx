'use client'

import { Canvas } from '@react-three/fiber'
import { PreviewCamera } from './camera/PreviewCamera'
import { World } from './world/World'

export function Game() {
  return (
    <Canvas
      shadows="percentage"
      // R3F's Canvas hardcodes the container div to width/height 100% and
      // merges any `style` prop on top — a `className` can't win against
      // that inline style, so the viewport-relative height has to go here.
      style={{ width: '100%', height: '100dvh' }}
      className="bg-[#e9e6dd]"
    >
      <PreviewCamera />
      <World />
    </Canvas>
  )
}
