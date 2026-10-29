'use client'

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Raycaster, Vector2 } from 'three'
import type { GalleryTheme } from '../themes'
import { Person, type Motion } from '../world/people/Person'
import type { GalleryRoomTemplate } from '../world/roomsData'
import { useClubHostStore, type ClubHostInfo } from './host'

const MAX_DISTANCE = 3.5

/** Where the host stands: just inside the way in, to the right as one walks in, facing the room. */
export function clubHostSpot(template: GalleryRoomTemplate): { spot: [number, number]; facing: number } | null {
  const entrance = template.doorways[0]
  if (!entrance) return null
  const inward = entrance.center[2] > (template.bounds[1] + template.bounds[3]) / 2 ? -1 : 1
  return { spot: [entrance.center[0] + 1.5, entrance.center[2] + inward * 1.1], facing: inward < 0 ? Math.PI - 0.35 : -0.35 }
}

// The member's avatar, standing just inside the way in and facing the room.
// Looking at them from close by, E (or the touch button) opens their welcome
// letter (WelcomeLetter.tsx).
export function ClubHost({ template, theme, host, active }: { template: GalleryRoomTemplate; theme: GalleryTheme; host: ClubHostInfo; active: boolean }) {
  const ray = useRef(new Raycaster())
  const placement = clubHostSpot(template)

  useFrame(({ camera, scene }) => {
    let aiming = false
    if (active) {
      ray.current.setFromCamera(new Vector2(0, 0), camera)
      const hit = ray.current.intersectObjects(scene.children, true).find(({ object }) => !object.userData.navigationMarker)
      if (hit && hit.distance <= MAX_DISTANCE) {
        for (let object = hit.object; object; object = object.parent!) if (object.userData.clubHost) aiming = true
      }
    }
    if (useClubHostStore.getState().aiming !== aiming) useClubHostStore.getState().setAiming(aiming)
  })
  useEffect(() => () => useClubHostStore.setState({ aiming: false, open: false }), [])

  if (!placement) return null
  const { spot, facing } = placement
  const stand = (): Motion => ({ moving: false, facing, step: 0 })
  return (
    <group>
      <Person appearance={{ look: 3, shirt: '#2f4a6b', avatar: host.avatarId }} theme={theme} start={spot} phase={0.4} move={stand} />
      {/* What the aim ray hits: the body's own meshes load late and vary per avatar. */}
      <mesh position={[spot[0], 0.9, spot[1]]} userData={{ clubHost: true }}>
        <boxGeometry args={[0.6, 1.8, 0.6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}
