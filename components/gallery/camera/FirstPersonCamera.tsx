'use client'

import { PointerLockControls } from '@react-three/drei'

type FirstPersonCameraProps = {
  /** CSS selector for the element(s) whose click should engage pointer lock. */
  selector: string
  onLock?: () => void
  onUnlock?: () => void
}

/**
 * Rotation only (mouse-look via Pointer Lock) — Player owns position/movement.
 * Kept separate so a future ThirdPersonCamera can swap in without touching Player.
 */
export function FirstPersonCamera({ selector, onLock, onUnlock }: FirstPersonCameraProps) {
  return <PointerLockControls selector={selector} onLock={onLock} onUnlock={onUnlock} />
}
