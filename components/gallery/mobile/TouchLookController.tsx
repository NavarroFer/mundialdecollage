'use client'

import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useTouchStore } from './touchStore'

const LOOK_SENSITIVITY = 0.0035
const PITCH_LIMIT = Math.PI / 2 - 0.05

const euler = new THREE.Euler(0, 0, 0, 'YXZ')

/**
 * Touch-drag look, parallel to FirstPersonCamera's mouse-based one — mobile
 * browsers don't support Pointer Lock the same way desktop does, so this is
 * the mobile equivalent rather than a shared implementation.
 */
export function TouchLookController({ active }: { active: boolean }) {
  const camera = useThree((state) => state.camera)

  useFrame(() => {
    const { x, y } = useTouchStore.getState().consumeLookDelta()
    if (!active || (x === 0 && y === 0)) return

    euler.setFromQuaternion(camera.quaternion)
    euler.y -= x * LOOK_SENSITIVITY
    euler.x -= y * LOOK_SENSITIVITY
    euler.x = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, euler.x))
    camera.quaternion.setFromEuler(euler)
  })

  return null
}
