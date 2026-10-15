'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGalleryPreferences } from '../preferences/store'
import { edgeTurn } from './edgeTurn'

// Radians a second with the cursor at the edge: a whole turn in about 3.5 s.
const MAX_TURN_SPEED = 1.8
// Less than this after a click is a hand resting on the mouse, not looking around.
const REST_PX = 8
// After a stutter (another tab, a slow frame) don't jump the whole gap at once.
const MAX_FRAME = 0.1

const euler = new THREE.Euler(0, 0, 0, 'YXZ')

/**
 * Looking around with a free cursor and no button held: towards either side
 * of the canvas the view turns that way, faster nearer the edge, and around
 * the middle it holds still so a click can aim at the floor or an obra.
 * Sideways only: taking the cursor down to the floor shouldn't tilt the view
 * (dragging, in PointNavigation, still does). A click stops it until the
 * mouse moves again, so the view doesn't keep spinning after the walk starts.
 */
export function EdgeLook({ active }: { active: boolean }) {
  const camera = useThree((state) => state.camera)
  const canvas = useThree((state) => state.gl.domElement)
  const cursor = useRef({ across: 0.5, inside: false, held: false, rest: null as { x: number; y: number } | null })

  // Back from the start screen or an obra, wait for the mouse to move: where
  // it was before may not be where it is now.
  useEffect(() => {
    if (active) cursor.current.inside = false
  }, [active])

  useEffect(() => {
    const state = cursor.current
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      const rect = canvas.getBoundingClientRect()
      state.across = (event.clientX - rect.left) / rect.width
      state.inside = true
      if (state.rest && Math.hypot(event.clientX - state.rest.x, event.clientY - state.rest.y) > REST_PX) state.rest = null
    }
    const down = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      state.held = true
      state.rest = { x: event.clientX, y: event.clientY }
    }
    const up = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      state.held = false
      state.rest = { x: event.clientX, y: event.clientY }
    }
    // Off the window, or onto the minimap or a button over the canvas.
    const leave = () => {
      state.inside = false
    }
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    canvas.addEventListener('pointerleave', leave)
    return () => {
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('pointerleave', leave)
    }
  }, [canvas])

  useFrame((_, delta) => {
    const { across, inside, held, rest } = cursor.current
    if (!active || !inside || held || rest) return
    const turn = edgeTurn(across)
    if (turn === 0) return
    euler.setFromQuaternion(camera.quaternion)
    euler.y -= turn * MAX_TURN_SPEED * useGalleryPreferences.getState().sensitivity * Math.min(delta, MAX_FRAME)
    camera.quaternion.setFromEuler(euler)
  })

  return null
}
