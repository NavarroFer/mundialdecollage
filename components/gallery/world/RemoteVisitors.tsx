'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { GalleryTheme } from '../themes'
import { appearanceFor, MAX_LIVE_VISITORS } from '../presence/protocol'
import { peerPoses, usePresenceStore } from '../presence/store'
import { LOOK_COUNT, Person, type Motion } from './people/Person'

// Farther than this from the last known spot (a reload, a missed stretch of
// messages) and the avatar jumps there instead of gliding through walls.
const TELEPORT_DISTANCE = 4
// Positions arrive ~3 times a second; easing toward the latest one hides the
// gaps. Below this speed (m/s) the legs stop walking.
const EASING = 6
const WALKING_SPEED = 0.25

function RemoteVisitor({ peerKey, theme }: { peerKey: string; theme: GalleryTheme }) {
  const appearance = useMemo(() => appearanceFor(peerKey, LOOK_COUNT), [peerKey])
  const placed = useRef(false)

  function followPose(person: THREE.Group, delta: number): Motion {
    const pose = peerPoses.get(peerKey)
    person.visible = Boolean(pose)
    if (!pose) return { moving: false, facing: person.rotation.y, step: 0 }
    // The minimap heading is 0 when looking toward -Z; a Person faces +Z at 0.
    const facing = Math.PI - pose.h
    if (!placed.current || Math.hypot(pose.x - person.position.x, pose.z - person.position.z) > TELEPORT_DISTANCE) {
      placed.current = true
      person.position.x = pose.x
      person.position.z = pose.z
      person.rotation.y = facing
      return { moving: false, facing, step: 0 }
    }
    const x = THREE.MathUtils.damp(person.position.x, pose.x, EASING, delta)
    const z = THREE.MathUtils.damp(person.position.z, pose.z, EASING, delta)
    const step = Math.hypot(x - person.position.x, z - person.position.z)
    person.position.x = x
    person.position.z = z
    return { moving: delta > 0 && step / delta > WALKING_SPEED, facing, step }
  }

  return <Person appearance={appearance} theme={theme} start={[0, 0]} marker move={followPose} />
}

export function RemoteVisitors({ theme }: { theme: GalleryTheme }) {
  const peers = usePresenceStore((state) => state.peers)
  const crowded = usePresenceStore((state) => (state.count ?? 0) > MAX_LIVE_VISITORS)
  if (crowded) return null
  return <group>{peers.map((key) => <RemoteVisitor key={key} peerKey={key} theme={theme} />)}</group>
}
