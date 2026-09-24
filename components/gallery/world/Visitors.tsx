'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { GalleryTheme } from '../themes'
import { MAX_LIVE_VISITORS } from '../presence/protocol'
import { usePresenceStore } from '../presence/store'

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
  collage: { skin: '#d69b72', dark: '#33271f', emissive: '#000000', pixel: false },
  windows98: { skin: '#ffff00', dark: '#000080', emissive: '#000000', pixel: true },
  garden: { skin: '#c99573', dark: '#205d3a', emissive: '#000000', pixel: false },
}

const LOOKS = [
  { skin: '#c99573', hair: '#33251f', trousers: '#384252', height: 1.02 },
  { skin: '#82543e', hair: '#211d1b', trousers: '#363332', height: 0.96 },
  { skin: '#e5b99a', hair: '#786252', trousers: '#404a43', height: 1.06 },
  { skin: '#b77f5d', hair: '#29211d', trousers: '#34404d', height: 1 },
  { skin: '#dbac89', hair: '#554039', trousers: '#3d3340', height: 0.94 },
]
export const LOOK_COUNT = LOOKS.length

/** Which of the looks (build + hairstyle) and what shirt color. */
export type Appearance = { look: number; shirt: string }

/** What a person's driver decided this frame; Person animates the rest. */
export type Motion = { moving: boolean; facing: number; step: number }

type PersonProps = {
  appearance: Appearance
  theme: GalleryTheme
  start: [number, number]
  /** Offsets idle head sway so people don't move in lockstep. */
  phase?: number
  /** A small marker overhead: this is a real visitor, not a scripted one. */
  marker?: boolean
  /** Moves the root group's x/z (and may hide it); called every frame. */
  move: (person: THREE.Group, delta: number) => Motion
}

export function Person({ appearance, theme, start, phase = 0, marker = false, move }: PersonProps) {
  const root = useRef<THREE.Group>(null)
  const leftArm = useRef<THREE.Group>(null)
  const rightArm = useRef<THREE.Group>(null)
  const leftLeg = useRef<THREE.Group>(null)
  const rightLeg = useRef<THREE.Group>(null)
  const elapsed = useRef(phase)
  const palette = themeSkin[theme]

  const head = useRef<THREE.Group>(null)
  const gait = useRef(0)

  useFrame((_, frameDelta) => {
    const person = root.current
    if (!person) return
    const delta = Math.min(frameDelta, 0.05)
    elapsed.current += delta
    const { moving, facing, step } = move(person, delta)
    gait.current += step * 9

    // Always take the shortest turn, including across the -PI / PI boundary.
    const turn = Math.atan2(Math.sin(facing - person.rotation.y), Math.cos(facing - person.rotation.y))
    person.rotation.y += turn * (1 - Math.exp(-6 * delta))
    const stride = moving ? Math.sin(gait.current) * 0.3 : 0
    for (const [joint, target] of [
      [leftArm, stride * 0.7], [rightArm, -stride * 0.7],
      [leftLeg, -stride], [rightLeg, stride],
    ] as const) {
      if (joint.current) joint.current.rotation.x = THREE.MathUtils.damp(joint.current.rotation.x, target, 10, delta)
    }
    if (head.current) {
      head.current.rotation.y = THREE.MathUtils.damp(head.current.rotation.y, moving ? 0 : Math.sin(elapsed.current * 0.55) * 0.14, 4, delta)
      head.current.rotation.z = Math.sin(elapsed.current * 0.7) * 0.025
    }
    person.position.y = THREE.MathUtils.damp(person.position.y, moving ? Math.abs(Math.sin(gait.current)) * 0.012 : 0, 10, delta)
  })

  const segments = palette.pixel ? 8 : 16
  const look = LOOKS[appearance.look % LOOKS.length]
  const hairstyle = appearance.look % LOOKS.length
  const skin = palette.pixel ? palette.skin : look.skin
  const shirt = appearance.shirt

  function ellipsoid(position: [number, number, number], scale: [number, number, number], color: string) {
    return (
      <mesh position={position} scale={scale} castShadow>
        <sphereGeometry args={[1, segments, segments]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
    )
  }

  return (
    <group ref={root} position={[start[0], 0, start[1]]} scale={look.height}>
      {/* Rounded shoulders, a tapered waist, and a separate neck. */}
      {ellipsoid([0, 1.17, 0], [0.235, 0.31, 0.135], shirt)}
      {ellipsoid([0, 0.91, 0], [0.19, 0.14, 0.13], look.trousers)}
      {ellipsoid([0, 1.47, 0], [0.065, 0.105, 0.065], skin)}
      <group ref={head} position={[0, 1.64, 0]}>
        {ellipsoid([0, 0, 0], [0.125, 0.17, 0.115], skin)}
        {/* Each visitor has a distinct silhouette: crop, curls, side part, bun, or long hair. */}
        {hairstyle === 0 && (
          <>
            {ellipsoid([0, 0.12, -0.015], [0.128, 0.065, 0.115], look.hair)}
            {ellipsoid([0, 0.074, 0.07], [0.11, 0.028, 0.05], look.hair)}
          </>
        )}
        {hairstyle === 1 && (
          <>
            {ellipsoid([0, 0.1, -0.015], [0.145, 0.098, 0.13], look.hair)}
            {[-0.1, 0, 0.1].map((x) => (
              <group key={x}>
                {ellipsoid([x, 0.17, 0.02], [0.061, 0.055, 0.06], look.hair)}
                {ellipsoid([x, 0.115, 0.09], [0.048, 0.04, 0.045], look.hair)}
              </group>
            ))}
          </>
        )}
        {hairstyle === 2 && (
          <>
            {ellipsoid([0, 0.105, -0.025], [0.133, 0.079, 0.115], look.hair)}
            {ellipsoid([-0.06, 0.078, 0.065], [0.067, 0.034, 0.056], look.hair)}
            {ellipsoid([0.087, 0.058, 0.028], [0.037, 0.066, 0.077], look.hair)}
          </>
        )}
        {hairstyle === 3 && (
          <>
            {ellipsoid([0, 0.094, -0.025], [0.13, 0.071, 0.113], look.hair)}
            {ellipsoid([0, 0.085, -0.108], [0.123, 0.119, 0.048], look.hair)}
            {ellipsoid([0, 0.21, -0.102], [0.079, 0.081, 0.075], look.hair)}
          </>
        )}
        {hairstyle === 4 && (
          <>
            {ellipsoid([0, 0.098, -0.04], [0.14, 0.087, 0.12], look.hair)}
            {ellipsoid([0, -0.051, -0.117], [0.127, 0.17, 0.049], look.hair)}
            {[-1, 1].map((side) => (
              <group key={side}>
                {ellipsoid([side * 0.125, -0.083, -0.025], [0.043, 0.15, 0.065], look.hair)}
              </group>
            ))}
          </>
        )}
        {ellipsoid([-0.124, -0.012, 0], [0.024, 0.041, 0.025], skin)}
        {ellipsoid([0.124, -0.012, 0], [0.024, 0.041, 0.025], skin)}
        {ellipsoid([0, -0.017, 0.108], [0.023, 0.034, 0.033], skin)}
        {[-1, 1].map((side) => (
          <group key={side}>
            {ellipsoid([side * 0.046, 0.025, 0.103], [0.022, 0.012, 0.009], '#eee5d9')}
            {ellipsoid([side * 0.046, 0.025, 0.111], [0.008, 0.009, 0.004], '#302820')}
            {ellipsoid([side * 0.046, 0.051, 0.102], [0.025, 0.005, 0.007], look.hair)}
          </group>
        ))}
        {ellipsoid([0, -0.069, 0.101], [0.032, 0.006, 0.008], '#925e50')}
      </group>
      {([-1, 1] as const).map((side) => (
        <group key={side}>
          <group ref={side === -1 ? leftArm : rightArm} position={[side * 0.225, 1.38, 0]} rotation={[0, 0, side * 0.08]}>
            {ellipsoid([side * 0.025, -0.12, 0], [0.078, 0.18, 0.08], shirt)}
            <group position={[side * 0.03, -0.28, 0]} rotation={[-0.12, 0, 0]}>
              {ellipsoid([0, -0.1, 0], [0.048, 0.135, 0.049], skin)}
              {ellipsoid([0, -0.245, 0], [0.044, 0.073, 0.03], skin)}
              {ellipsoid([-side * 0.035, -0.225, 0.016], [0.019, 0.036, 0.018], skin)}
            </group>
          </group>
          <group ref={side === -1 ? leftLeg : rightLeg} position={[side * 0.103, 0.89, 0]}>
            {ellipsoid([0, -0.2, 0], [0.091, 0.245, 0.1], look.trousers)}
            {ellipsoid([0, -0.56, 0], [0.069, 0.22, 0.077], look.trousers)}
            {ellipsoid([0, -0.825, 0.055], [0.082, 0.065, 0.145], '#292726')}
          </group>
        </group>
      ))}
      {marker && (
        <mesh position={[0, 2.08, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.075, 0.15, palette.pixel ? 4 : 12]} />
          <meshBasicMaterial color={shirt} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

function Visitor({ definition, theme }: { definition: VisitorDefinition; theme: GalleryTheme }) {
  const initialIndex = definition.offset % definition.route.length
  const routeIndex = useRef(initialIndex)
  const pauseLeft = useRef(definition.route[initialIndex].wait ?? 0)

  function walkRoute(person: THREE.Group, delta: number): Motion {
    if (pauseLeft.current > 0) {
      pauseLeft.current = Math.max(0, pauseLeft.current - delta)
      return { moving: false, facing: definition.route[routeIndex.current].face ?? person.rotation.y, step: 0 }
    }
    const nextIndex = (routeIndex.current + 1) % definition.route.length
    const target = definition.route[nextIndex]
    const dx = target.position[0] - person.position.x
    const dz = target.position[1] - person.position.z
    const distance = Math.hypot(dx, dz)
    if (distance < 0.04) {
      routeIndex.current = nextIndex
      pauseLeft.current = target.wait ?? 0
      return { moving: false, facing: person.rotation.y, step: 0 }
    }
    const step = Math.min(distance, definition.speed * delta)
    person.position.x += (dx / distance) * step
    person.position.z += (dz / distance) * step
    return { moving: true, facing: Math.atan2(dx, dz), step }
  }

  return (
    <Person
      appearance={{ look: definition.offset, shirt: definition.color }}
      theme={theme}
      start={definition.route[initialIndex].position}
      phase={definition.offset * 1.7}
      move={walkRoute}
    />
  )
}

export function Visitors({ theme }: { theme: GalleryTheme }) {
  // Real visitors take the scripted ones' place, so the room reads as busy
  // as it really is once people show up (all five return in a crowd too big
  // for live avatars).
  const realVisitors = usePresenceStore((state) => (state.count ?? 0) > MAX_LIVE_VISITORS ? 0 : state.peers.length)
  const scripted = VISITORS.slice(0, Math.max(0, VISITORS.length - realVisitors))
  return <group>{scripted.map((definition) => <Visitor key={definition.id} definition={definition} theme={theme} />)}</group>
}
