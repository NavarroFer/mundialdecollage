'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { GalleryTheme } from '../themes'

type Stop = {
  position: [number, number]
  wait?: number
  face?: number
}

type VisitorDefinition = {
  id: string
  color: string
  speed: number
  offset: number
  route: Stop[]
}

const VISITORS: VisitorDefinition[] = [
  {
    id: 'visitor-01', color: '#d45b45', speed: 0.62, offset: 0,
    route: [
      { position: [-16, -3.45], wait: 3.5, face: Math.PI },
      { position: [-11.5, -3.45], wait: 4, face: Math.PI },
      { position: [-7.2, 0] },
      { position: [-10, 3.45], wait: 3, face: 0 },
      { position: [-16, 3.45], wait: 4, face: 0 },
    ],
  },
  {
    id: 'visitor-02', color: '#4c76b8', speed: 0.54, offset: 2,
    route: [
      { position: [-4.4, 3.4], wait: 3, face: 0 },
      { position: [0, 3.4], wait: 4.5, face: 0 },
      { position: [4.4, 3.4], wait: 3.5, face: 0 },
      { position: [4.5, -3.4], wait: 3, face: Math.PI },
      { position: [-3.8, -3.4], wait: 4, face: Math.PI },
    ],
  },
  {
    id: 'visitor-03', color: '#d6a62e', speed: 0.58, offset: 4,
    route: [
      { position: [7.3, 0] },
      { position: [9.2, -3.4], wait: 4, face: Math.PI },
      { position: [15, -3.4], wait: 3.5, face: Math.PI },
      { position: [16, 3.4], wait: 4, face: 0 },
      { position: [10.2, 3.4], wait: 3, face: 0 },
    ],
  },
  {
    id: 'visitor-04', color: '#6f8d63', speed: 0.7, offset: 1,
    route: [
      { position: [-15, -1.2], wait: 2 },
      { position: [-6.8, 0] },
      { position: [0, -2.8], wait: 3, face: Math.PI },
      { position: [6.8, 0] },
      { position: [14, 1.4], wait: 2.5 },
      { position: [6.8, 0] },
      { position: [0, 2.8], wait: 3, face: 0 },
      { position: [-6.8, 0] },
    ],
  },
  {
    id: 'visitor-05', color: '#8d63a8', speed: 0.48, offset: 3,
    route: [
      { position: [-14, 2.6], wait: 3.5, face: 0 },
      { position: [-7, 0] },
      { position: [-2.2, -3.35], wait: 4, face: Math.PI },
      { position: [5, 0] },
      { position: [10, -3.35], wait: 3.5, face: Math.PI },
      { position: [5, 0] },
      { position: [-1, 3.35], wait: 4, face: 0 },
      { position: [-7, 0] },
    ],
  },
]

const themeSkin: Record<GalleryTheme, { skin: string; dark: string; emissive: string; pixel: boolean }> = {
  museum: { skin: '#c99573', dark: '#262522', emissive: '#000000', pixel: false },
  windows98: { skin: '#ffff00', dark: '#000080', emissive: '#000000', pixel: true },
  ps2: { skin: '#8fa2d8', dark: '#050515', emissive: '#244bff', pixel: true },
  collage: { skin: '#d69b72', dark: '#33271f', emissive: '#000000', pixel: false },
}

function Visitor({ definition, theme }: { definition: VisitorDefinition; theme: GalleryTheme }) {
  const initialIndex = definition.offset % definition.route.length
  const root = useRef<THREE.Group>(null)
  const leftArm = useRef<THREE.Group>(null)
  const rightArm = useRef<THREE.Group>(null)
  const leftLeg = useRef<THREE.Group>(null)
  const rightLeg = useRef<THREE.Group>(null)
  const routeIndex = useRef(initialIndex)
  const pauseLeft = useRef(definition.route[initialIndex].wait ?? 0)
  const elapsed = useRef(definition.offset * 1.7)
  const palette = themeSkin[theme]

  useFrame((_, delta) => {
    const person = root.current
    if (!person) return
    elapsed.current += delta

    if (pauseLeft.current > 0) {
      pauseLeft.current = Math.max(0, pauseLeft.current - delta)
      const stop = definition.route[routeIndex.current]
      if (stop.face !== undefined) person.rotation.y = THREE.MathUtils.damp(person.rotation.y, stop.face, 5, delta)
      person.position.y = Math.sin(elapsed.current * 1.6) * 0.008
      return
    }

    const nextIndex = (routeIndex.current + 1) % definition.route.length
    const target = definition.route[nextIndex]
    const dx = target.position[0] - person.position.x
    const dz = target.position[1] - person.position.z
    const distance = Math.hypot(dx, dz)

    if (distance < 0.08) {
      routeIndex.current = nextIndex
      pauseLeft.current = target.wait ?? 0
      return
    }

    const step = Math.min(distance, definition.speed * delta)
    person.position.x += (dx / distance) * step
    person.position.z += (dz / distance) * step
    person.rotation.y = THREE.MathUtils.damp(person.rotation.y, Math.atan2(dx, dz), 9, delta)

    const stride = Math.sin(elapsed.current * 8.5) * 0.48
    if (leftArm.current) leftArm.current.rotation.x = stride
    if (rightArm.current) rightArm.current.rotation.x = -stride
    if (leftLeg.current) leftLeg.current.rotation.x = -stride
    if (rightLeg.current) rightLeg.current.rotation.x = stride
    person.position.y = Math.abs(Math.sin(elapsed.current * 8.5)) * 0.018
  })

  const start = definition.route[initialIndex].position
  const segments = palette.pixel ? 5 : 12

  return (
    <group ref={root} position={[start[0], 0, start[1]]}>
      <mesh position={[0, 1.55, 0]} castShadow>
        <sphereGeometry args={[0.2, segments, segments]} />
        <meshStandardMaterial color={palette.skin} roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.18, 0]} castShadow>
        <boxGeometry args={[0.45, 0.62, 0.25]} />
        <meshStandardMaterial color={theme === 'ps2' ? palette.dark : definition.color} roughness={0.7}
          emissive={palette.emissive} emissiveIntensity={theme === 'ps2' ? 0.35 : 0} />
      </mesh>
      <group ref={leftArm} position={[-0.29, 1.4, 0]}>
        <mesh position={[0, -0.28, 0]} castShadow><boxGeometry args={[0.13, 0.58, 0.14]} /><meshStandardMaterial color={definition.color} /></mesh>
      </group>
      <group ref={rightArm} position={[0.29, 1.4, 0]}>
        <mesh position={[0, -0.28, 0]} castShadow><boxGeometry args={[0.13, 0.58, 0.14]} /><meshStandardMaterial color={definition.color} /></mesh>
      </group>
      <group ref={leftLeg} position={[-0.13, 0.88, 0]}>
        <mesh position={[0, -0.36, 0]} castShadow><boxGeometry args={[0.17, 0.72, 0.19]} /><meshStandardMaterial color={palette.dark} /></mesh>
      </group>
      <group ref={rightLeg} position={[0.13, 0.88, 0]}>
        <mesh position={[0, -0.36, 0]} castShadow><boxGeometry args={[0.17, 0.72, 0.19]} /><meshStandardMaterial color={palette.dark} /></mesh>
      </group>
      {theme === 'ps2' && <pointLight position={[0, 1.1, -0.1]} color="#4164ff" intensity={0.35} distance={1.2} />}
    </group>
  )
}

export function Visitors({ theme }: { theme: GalleryTheme }) {
  return <group>{VISITORS.map((definition) => <Visitor key={definition.id} definition={definition} theme={theme} />)}</group>
}
