'use client'

import { PRESETS } from '../graphics/quality'
import { useGraphics } from '../graphics/store'
import { useRef } from 'react'
import * as THREE from 'three'
import type { GalleryTheme } from '../themes'
import { MAX_LIVE_VISITORS } from '../presence/protocol'
import { usePresenceStore } from '../presence/store'
import { SCRIPTED_CAST } from './people/cast'
import { Person, type Motion } from './people/Person'
import { VISITORS, type VisitorDefinition } from './visitorRoutes'

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
      appearance={{ look: definition.offset, shirt: definition.color, avatar: SCRIPTED_CAST[definition.id] }}
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
  const quality = useGraphics((s) => s.current)
  const scripted = VISITORS.slice(0, Math.max(0, PRESETS[quality].visitors - realVisitors))
  return <group>{scripted.map((definition) => <Visitor key={definition.id} definition={definition} theme={theme} />)}</group>
}
