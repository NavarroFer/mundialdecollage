'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshReflectorMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useGraphics } from '../../graphics/store'
import { marFloors } from './layout'
import { canvasOf, canvasTexture, seeded } from './textures'

const polishedFloors = marFloors.filter((floor) => floor.kind === 'polish')

/** One reflection pass shared by the contiguous polished ground-floor surfaces. */
export function InteriorFloor() {
  const quality = useGraphics((s) => s.current)
  const mobile = useGraphics((s) => s.mobile)
  const [inside, setInside] = useState(false)
  const current = useRef(false)
  useFrame(({ camera }) => {
    const p = camera.position
    const next = p.y < 4.3 && polishedFloors.some((floor) => p.x >= floor.x0 && p.x <= floor.x1 && p.z >= floor.z0 && p.z <= floor.z1)
    if (next !== current.current) { current.current = next; setInside(next) }
  })
  const geometry = useMemo(() => {
    const planes = polishedFloors.map((floor) => {
      const plane = new THREE.PlaneGeometry(floor.x1 - floor.x0, floor.z1 - floor.z0)
        .translate((floor.x0 + floor.x1) / 2, -(floor.z0 + floor.z1) / 2, 0)
      const pos = plane.getAttribute('position')
      const uv = plane.getAttribute('uv')
      for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 0.72, pos.getY(i) / 0.72)
      return plane
    })
    const merged = mergeGeometries(planes)!
    planes.forEach((plane) => plane.dispose())
    return merged
  }, [])
  const grain = useMemo(() => {
    const { canvas, context } = canvasOf(256, 256)
    context.fillStyle = '#a49e96'
    context.fillRect(0, 0, 256, 256)
    const random = seeded(82)
    for (let i = 0; i < 6400; i++) {
      const value = Math.round(71 + random() * 149)
      context.fillStyle = `rgb(${value}, ${Math.round(value * 0.975)}, ${Math.round(value * 0.93)})`
      const size = 0.35 + random() * 1.3
      context.fillRect(random() * 256, random() * 256, size, size)
    }
    return canvasTexture(canvas)
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
      color="#5b5754"
      map={grain}
      roughness={0.3}
      metalness={0.08}
    /> : <meshStandardMaterial color="#5b5754" map={grain} roughness={0.34} metalness={0.08} />}
  </mesh>
}
