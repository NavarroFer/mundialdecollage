'use client'

import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { GalleryTheme } from '../themes'
import { HOP_SECONDS, hopHeight } from '../player/jump'
import { appearanceFor, MAX_LIVE_VISITORS } from '../presence/protocol'
import { peerPoses, usePresenceStore } from '../presence/store'
import { castMember, REMOTE_CAST } from './people/cast'
import { LOOK_COUNT, Person, type Motion } from './people/Person'

// Farther than this from the last known spot (a reload, a missed stretch of
// messages) and the avatar jumps there instead of gliding through walls.
const TELEPORT_DISTANCE = 4
// Positions arrive ~3 times a second; easing toward the latest one hides the
// gaps. Below this speed (m/s) the legs stop walking.
const EASING = 6
const WALKING_SPEED = 0.25
// Squatting or standing back up takes about a fifth of a second.
const CROUCH_EASING = 8
// How far the knees bend in the air, as a share of a full squat.
const TUCK = 0.35

type Hop = {
  /** The visitor's hop count already played (or skipped, when they appeared). */
  seen: number
  /** Seconds into the hop on screen, or null on the floor. */
  t: number | null
  /** Another hop arrived mid-air: it starts on landing. */
  queued: boolean
}

function RemoteVisitor({ peerKey, theme }: { peerKey: string; theme: GalleryTheme }) {
  // The avatar they picked arrives with their positions; until then (or if they never picked) chance decides.
  const [chosen, setChosen] = useState(() => peerPoses.get(peerKey)?.avatar)
  const appearance = useMemo(() => ({
    ...appearanceFor(peerKey, LOOK_COUNT),
    avatar: castMember(chosen)?.name ?? REMOTE_CAST[appearanceFor(peerKey, REMOTE_CAST.length).look].name,
  }), [peerKey, chosen])
  const placed = useRef(false)
  const squat = useRef(0)
  const hop = useRef<Hop>({ seen: 0, t: null, queued: false })

  function followPose(person: THREE.Group, delta: number): Motion {
    const pose = peerPoses.get(peerKey)
    person.visible = Boolean(pose)
    if (pose && pose.avatar !== chosen) setChosen(pose.avatar)
    if (!pose) return { moving: false, facing: person.rotation.y, step: 0 }
    // The minimap heading is 0 when looking toward -Z; a Person faces +Z at 0.
    const facing = Math.PI - pose.h
    const jumps = pose.jumps ?? 0
    if (!placed.current || Math.hypot(pose.x - person.position.x, pose.z - person.position.z) > TELEPORT_DISTANCE) {
      placed.current = true
      person.position.set(pose.x, 0, pose.z)
      person.rotation.y = facing
      squat.current = pose.crouching ? 1 : 0
      // Only hops taken from here on play.
      hop.current = { seen: jumps, t: null, queued: false }
      return { moving: false, facing, step: 0, crouch: squat.current }
    }
    const x = THREE.MathUtils.damp(person.position.x, pose.x, EASING, delta)
    const z = THREE.MathUtils.damp(person.position.z, pose.z, EASING, delta)
    const step = Math.hypot(x - person.position.x, z - person.position.z)
    person.position.x = x
    person.position.z = z

    // Their hops arrive as a count; each new one plays the jump's own arc here.
    const air = hop.current
    if (jumps !== air.seen) {
      air.seen = jumps
      if (air.t === null) air.t = 0
      else air.queued = true
    }
    if (air.t !== null) {
      air.t += delta
      if (air.t >= HOP_SECONDS) {
        air.t = air.queued ? 0 : null
        air.queued = false
      }
    }
    person.position.y = air.t === null ? 0 : hopHeight(air.t)
    squat.current = THREE.MathUtils.damp(squat.current, pose.crouching ? 1 : 0, CROUCH_EASING, delta)
    const tuck = air.t === null ? 0 : TUCK * Math.sin((Math.PI * air.t) / HOP_SECONDS)
    return { moving: delta > 0 && step / delta > WALKING_SPEED, facing, step, crouch: Math.max(squat.current, tuck) }
  }

  return <Person appearance={appearance} theme={theme} start={[0, 0]} marker move={followPose} />
}

export function RemoteVisitors({ theme }: { theme: GalleryTheme }) {
  const peers = usePresenceStore((state) => state.peers)
  const crowded = usePresenceStore((state) => (state.count ?? 0) > MAX_LIVE_VISITORS)
  if (crowded) return null
  return <group>{peers.map((key) => <RemoteVisitor key={key} peerKey={key} theme={theme} />)}</group>
}
