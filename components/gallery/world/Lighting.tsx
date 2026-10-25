'use client'
import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import type { DirectionalLight } from 'three'
import type { GalleryTheme } from '../themes'
import { PRESETS } from '../graphics/quality'
import { useGraphics } from '../graphics/store'
import { rooms } from './roomsData'

const ROOM_CENTERS = rooms.map(({ bounds }) => (bounds[0] + bounds[2]) / 2)

export function Lighting({ theme }: { theme: GalleryTheme }) {
  const quality = useGraphics((s) => s.current)
  const mobile = useGraphics((s) => s.mobile)
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  const light = useRef<DirectionalLight>(null)
  const preset = PRESETS[quality]
  const mapSize = Math.min(preset.shadows, mobile ? 2048 : 4096, gl.capabilities.maxTextureSize)
  // Three does not resize an existing shadow target when mapSize changes.
  useEffect(() => {
    if (!light.current) return
    const shadow = light.current.shadow
    shadow.map?.dispose()
    shadow.map = null
    shadow.needsUpdate = true
    invalidate()
  }, [mapSize, invalidate])
  const garden = theme === 'garden'
  const retro = theme === 'windows98'
  const warm = theme === 'collage' ? '#ffe6c8' : '#fff7ee'
  return <>
    {/* Neutral sky bounce gives surfaces depth without tinting unlit artwork textures. */}
    <hemisphereLight color={garden ? '#dff6ff' : '#f3f6ff'} groundColor={garden ? '#56833f' : '#9a826b'} intensity={garden ? 1.35 : retro ? 1.2 : 0.85} />
    <ambientLight intensity={garden ? 0.35 : 0.3} color="#ffffff" />
    <directionalLight ref={light} position={garden ? [-8, 12, 5] : [6, 10, 4]}
      intensity={garden ? 2.2 : retro ? 1.4 : 1.15} color={retro ? '#ffffff' : warm}
      castShadow={mapSize > 0} shadow-mapSize={[Math.max(1, mapSize), Math.max(1, mapSize)]}
      shadow-camera-left={-22} shadow-camera-right={22} shadow-camera-top={18} shadow-camera-bottom={-18}
      shadow-camera-near={0.1} shadow-camera-far={60} shadow-bias={-0.00015} shadow-normalBias={0.025}
      shadow-radius={2} />
    {!garden && !retro && ROOM_CENTERS.flatMap((x) => (quality === 'low' ? [0] : [-3.25, 3.25]).map((z) =>
      <pointLight key={`${x}-${z}`} position={[x, 2.85, z]} intensity={quality === 'low' ? 11 : 8} distance={quality === 'low' ? 9 : 7.5} decay={2} color={warm} />))}
  </>
}
