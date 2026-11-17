'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Raycaster, Vector2, Vector3 } from 'three'
import { aimAt } from '../navigation/aim'
import { flagDistance, hintAnchor, nearFlag } from './hint'
import { FLAG_REACH, flagAim, flagPickable, useFlagHintStore, useFlagStore } from './store'

// How often to look again whether the cloth is in clear view; in between, the hand just follows it.
const CHECK_MS = 300
// Less than this on screen isn't worth moving the hand for.
const STILL_PX = 0.5

const eye = new Vector3()
const anchor = new Vector3()
const pointer = new Vector2()

/**
 * Inside the Canvas, what MAR's hall flag needs from the scene: which of its
 * pictures E points at (the one under the mouse, or under the crosshair with
 * the mouse captured), and, while the visitor is near it, where on screen
 * the floating hand that says so goes (FlagHint). The hand only shows with
 * the cloth in clear view, the same test as a real click's.
 */
export function FlagTracker({ active }: { active: boolean }) {
  const { camera, scene, gl, size } = useThree()
  const ray = useMemo(() => new Raycaster(), [])
  const near = useRef(false)
  const clear = useRef(false)
  const checkedAt = useRef(-Infinity)

  useEffect(() => {
    const canvas = gl.domElement
    let mouse: { x: number; y: number } | null = null
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') mouse = { x: event.clientX, y: event.clientY }
    }
    // Off the canvas, or onto a button over it.
    const leave = () => {
      mouse = null
    }
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerleave', leave)
    flagAim.current = () => {
      if (mouse && document.pointerLockElement === null) {
        const rect = canvas.getBoundingClientRect()
        pointer.set(((mouse.x - rect.left) / rect.width) * 2 - 1, -((mouse.y - rect.top) / rect.height) * 2 + 1)
      } else pointer.set(0, 0)
      ray.setFromCamera(pointer, camera)
      const aim = aimAt(ray.intersectObjects(scene.children, true))
      return aim?.kind === 'flag' && aim.distance <= FLAG_REACH ? { u: aim.u, v: aim.v } : null
    }
    return () => {
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerleave', leave)
      flagAim.current = null
    }
  }, [camera, scene, gl, ray])

  useEffect(() => () => useFlagHintStore.setState({ spot: null }), [])

  useFrame(() => {
    const hint = useFlagHintStore.getState()
    const hide = () => {
      if (hint.spot) useFlagHintStore.setState({ spot: null })
    }
    camera.getWorldPosition(eye)
    near.current = active && flagPickable(useFlagStore.getState().layout) && nearFlag(flagDistance(eye.x, eye.z), near.current)
    if (!near.current) {
      checkedAt.current = -Infinity
      hide()
      return
    }

    const at = hintAnchor(eye)
    anchor.set(at.x, at.y, at.z).project(camera)
    // In front of the camera and well inside the frame.
    if (anchor.z < -1 || anchor.z > 1 || Math.abs(anchor.x) > 0.9 || Math.abs(anchor.y) > 0.9) {
      hide()
      return
    }
    const now = performance.now()
    if (now - checkedAt.current >= CHECK_MS) {
      checkedAt.current = now
      ray.setFromCamera(pointer.set(anchor.x, anchor.y), camera)
      clear.current = aimAt(ray.intersectObjects(scene.children, true))?.kind === 'flag'
    }
    if (!clear.current) {
      hide()
      return
    }

    const x = ((anchor.x + 1) / 2) * size.width
    const y = ((1 - anchor.y) / 2) * size.height
    if (hint.spot && Math.abs(hint.spot.x - x) < STILL_PX && Math.abs(hint.spot.y - y) < STILL_PX) return
    useFlagHintStore.setState({ spot: { x, y } })
  })

  return null
}
