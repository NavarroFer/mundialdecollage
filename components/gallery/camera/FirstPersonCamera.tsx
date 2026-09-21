'use client'

import { PointerLockControls } from '@react-three/drei'

type FirstPersonCameraProps = {
  /** CSS selector for the element(s) whose click should engage pointer lock. */
  selector: string
  /** Multiplier on raw mouse movement — drei/three-stdlib default is 1. */
  pointerSpeed?: number
  onLock?: () => void
  onUnlock?: () => void
}

/**
 * Rotation only (mouse-look via Pointer Lock) — Player owns position/movement.
 * Kept separate so a future ThirdPersonCamera can swap in without touching Player.
 */
export function FirstPersonCamera({ selector, pointerSpeed = 1, onLock, onUnlock }: FirstPersonCameraProps) {
  return <PointerLockControls selector={selector} pointerSpeed={pointerSpeed} onLock={onLock} onUnlock={onUnlock} />
}
