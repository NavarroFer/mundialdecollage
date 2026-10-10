'use client'

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

// three-stdlib's PointerLockControls values, so the mouse feels the same.
const MOUSE_SENSITIVITY = 0.002
const PITCH_LIMIT = Math.PI / 2

const euler = new THREE.Euler(0, 0, 0, 'YXZ')

type FirstPersonCameraProps = {
  /** The element Game locks the pointer to; the mouse only turns the camera while it holds the lock. */
  target: HTMLElement | null
  /** Multiplier on raw mouse movement. */
  pointerSpeed?: number
}

/**
 * Rotation only (mouse-look via Pointer Lock) — Player owns position/movement.
 * Game takes the lock itself, on the ENTRAR click, before this scene has even
 * loaded (drei's PointerLockControls only reacts to a click once it's
 * mounted), so this just follows the lock instead of owning it.
 * Kept separate so a future ThirdPersonCamera can swap in without touching Player.
 */
export function FirstPersonCamera({ target, pointerSpeed = 1 }: FirstPersonCameraProps) {
  const camera = useThree((state) => state.camera)

  useEffect(() => {
    if (!target) return
    function look(event: MouseEvent) {
      if (document.pointerLockElement !== target) return
      euler.setFromQuaternion(camera.quaternion)
      euler.y -= event.movementX * MOUSE_SENSITIVITY * pointerSpeed
      euler.x -= event.movementY * MOUSE_SENSITIVITY * pointerSpeed
      euler.x = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, euler.x))
      camera.quaternion.setFromEuler(euler)
    }
    document.addEventListener('mousemove', look)
    return () => document.removeEventListener('mousemove', look)
  }, [camera, target, pointerSpeed])

  return null
}
