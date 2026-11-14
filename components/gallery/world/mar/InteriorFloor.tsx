'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshReflectorMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useGraphics } from '../../graphics/store'
import { marFloors } from './layout'
import { canvasOf, canvasTexture, seeded } from './textures'

/** One reflection pass shared by the contiguous polished hall and café floors. */
export function InteriorFloor({ fallback }: { fallback: THREE.Material }) {
  const quality = useGraphics((s) => s.current)
  const mobile = useGraphics((s) => s.mobile)
  const [inside, setInside] = useState(false)
  const current = useRef(false)
  useFrame(({ camera }) => {
    const p = camera.position
    const next = p.x > -30 && p.x < 14 && p.z > -20 && p.z < 8 && p.y < 4.3
    if (next !== current.current) { current.current = next; setInside(next) }
  })
  const geometry = useMemo(() => {
    const planes = marFloors.filter((f) => f.kind === 'polish').map((f) => new THREE.PlaneGeometry(f.x1 - f.x0, f.z1 - f.z0).translate((f.x0 + f.x1) / 2, -(f.z0 + f.z1) / 2, 0))
    const merged = mergeGeometries(planes)!
    planes.forEach((plane) => plane.dispose())
    return merged
  }, [])
  const grain = useMemo(() => {
    const { canvas, context } = canvasOf(256, 256)
    context.fillStyle = '#8b8b8b'
    context.fillRect(0, 0, 256, 256)
    const random = seeded(82)
    for (let i = 0; i < 9500; i++) {
      const value = Math.round(95 + random() * 95)
      context.fillStyle = `rgb(${value},${value},${value})`
      context.fillRect(random() * 256, random() * 256, 0.5 + random(), 0.5 + random())
    }
    const texture = canvasTexture(canvas)
    texture.colorSpace = THREE.NoColorSpace
    texture.repeat.set(10, 10)
    return texture
  }, [])
  useEffect(() => () => { geometry.dispose(); grain.dispose() }, [geometry, grain])
  // The reflection is disabled outside, upstairs, on mobile and at low quality.
  // Those views retain the standard material and do not render a second scene.
  const reflected = inside && !mobile && quality === 'high'
  return <mesh geometry={geometry} position={[0, 0.038, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
    {reflected ? <MeshReflectorMaterial
      resolution={512}
      blur={[180, 55]}
      mixBlur={0.85}
      mixStrength={0.7}
      mirror={0.42}
      depthScale={0.35}
      minDepthThreshold={0.8}
      maxDepthThreshold={1.2}
      color="#302821"
      roughness={0.3}
      roughnessMap={grain}
      metalness={0.08}
    /> : <primitive object={fallback} attach="material" />}
  </mesh>
}
