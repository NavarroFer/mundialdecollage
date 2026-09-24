'use client'

import { useRef } from 'react'
import * as THREE from 'three'
import type { GalleryTheme } from '../themes'
import { MAX_LIVE_VISITORS } from '../presence/protocol'
import { usePresenceStore } from '../presence/store'
import { Person, type Motion } from './people/Person'

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
    id: 'visitor-01', color: '#5e3b2a', speed: 0.62, offset: 0,
    route: [
      { position: [-16, -3.45], wait: 3.5, face: Math.PI },
      { position: [-11.5, -3.45], wait: 4, face: Math.PI },
      { position: [-7.2, 0] },
      { position: [-10, 3.45], wait: 3, face: 0 },
      { position: [-16, 3.45], wait: 4, face: 0 },
    ],
  },
  {
    id: 'visitor-02', color: '#7b2d3b', speed: 0.54, offset: 2,
    route: [
      { position: [-4.4, 3.4], wait: 3, face: 0 },
      { position: [0, 3.4], wait: 4.5, face: 0 },
      { position: [4.4, 3.4], wait: 3.5, face: 0 },
      { position: [4.5, -3.4], wait: 3, face: Math.PI },
      { position: [-3.8, -3.4], wait: 4, face: Math.PI },
    ],
  },
  {
    id: 'visitor-03', color: '#c99a3a', speed: 0.58, offset: 4,
    route: [
      { position: [7.3, 0] },
      { position: [9.2, -3.4], wait: 4, face: Math.PI },
      { position: [15, -3.4], wait: 3.5, face: Math.PI },
      { position: [16, 3.4], wait: 4, face: 0 },
      { position: [10.2, 3.4], wait: 3, face: 0 },
    ],
  },
  {
    id: 'visitor-04', color: '#8fb3d9', speed: 0.7, offset: 1,
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
    id: 'visitor-05', color: '#6b7c4b', speed: 0.48, offset: 3,
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
