'use client'
/* eslint-disable react-hooks/immutability -- Three's scene is an imperative renderer object; restore it on cleanup. */
import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { PMREMGenerator } from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { PRESETS } from './quality'
import { useGraphics } from './store'

/** A small locally generated reflection probe, not a live mirror or external HDR. */
export function EnvironmentLight() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const invalidate = useThree((s) => s.invalidate)
  const enabled = useGraphics((s) => PRESETS[s.current].detail)
  useEffect(() => {
    if (!enabled) return
    const generator = new PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const target = generator.fromScene(room, 0.04, 0.1, 100, { size: 128 })
    room.dispose()
    generator.dispose()
    const previous = scene.environment
    const intensity = scene.environmentIntensity
    scene.environment = target.texture
    scene.environmentIntensity = 0.18
    invalidate()
    return () => {
      scene.environment = previous
      scene.environmentIntensity = intensity
      target.dispose()
      invalidate()
    }
  }, [enabled, gl, scene, invalidate])
  return null
}
