'use client'

import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { Raycaster, Vector2, Vector3 } from 'three'
import type { Artwork } from '@/data/artworks'
import { useInteractionStore } from '../interaction/store'
import { useTouchStore } from '../mobile/touchStore'
import { aimAt } from './aim'
import { findWalkPath, viewingSpot } from './path'
import { useNavigationStore } from './store'

// The same reach as E: closer than this, a click on an obra opens it on the spot.
const OPEN_DISTANCE = 3.5
// Any further and the mouse press was a drag to look around, not a click.
const DRAG_PX = 8
const CLICK_MS = 600

const pointer = new Vector2()
const playerPosition = new Vector3()

/**
 * Click-to-walk: a click (or a tap from TouchControls) on the floor walks
 * there along a route around the walls, and one on an obra walks up to it
 * and opens it. Dragging with the mouse looks around, the way a finger does
 * on a phone; WASD and the joystick keep working and take over at any time.
 */
export function PointNavigation({ active, touch, artworks, garden }: { active: boolean; touch: boolean; artworks: Artwork[]; garden: boolean }) {
  const { camera, scene, gl } = useThree()
  const ray = useMemo(() => new Raycaster(), [])
  const destination = useNavigationStore((state) => state.path.at(-1))

  useEffect(() => {
    if (!active) {
      useNavigationStore.getState().cancel()
      return
    }
    const canvas = gl.domElement

    // Clicks and taps arrive as screen points; aim them into the scene.
    const unsubscribe = useNavigationStore.subscribe((state, previous) => {
      if (!state.request || state.request === previous.request) return
      const rect = canvas.getBoundingClientRect()
      pointer.set(((state.request.x - rect.left) / rect.width) * 2 - 1, -((state.request.y - rect.top) / rect.height) * 2 + 1)
      ray.setFromCamera(pointer, camera)
      const aim = aimAt(ray.intersectObjects(scene.children, true))
      const artwork = aim?.kind === 'artwork' ? artworks.find(({ id }) => id === aim.id) : undefined
      const navigation = useNavigationStore.getState()
      if (artwork && aim?.kind === 'artwork' && aim.distance <= OPEN_DISTANCE) {
        navigation.cancel()
        useInteractionStore.getState().open(artwork.id)
        return
      }
      const to = artwork ? viewingSpot(artwork) : aim?.kind === 'spot' ? aim.point : null
      camera.getWorldPosition(playerPosition)
      const route = to && findWalkPath({ x: playerPosition.x, z: playerPosition.z }, to, garden)
      if (route) navigation.start(route, artwork?.id)
      else navigation.cancel(true)
    })

    // Touch has its own layer over the canvas (TouchControls), which sends taps here.
    if (touch) {
      return () => {
        unsubscribe()
        useNavigationStore.getState().cancel()
      }
    }

    let press: { id: number; x: number; y: number; lastX: number; lastY: number; at: number; dragged: boolean } | null = null
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return
      press = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, at: performance.now(), dragged: false }
      canvas.setPointerCapture(event.pointerId)
    }
    const move = (event: PointerEvent) => {
      if (press?.id !== event.pointerId) return
      if (!press.dragged && Math.hypot(event.clientX - press.x, event.clientY - press.y) > DRAG_PX) {
        press.dragged = true
        canvas.style.cursor = 'grabbing'
      }
      if (press.dragged) useTouchStore.getState().addLookDelta(event.clientX - press.lastX, event.clientY - press.lastY)
      press.lastX = event.clientX
      press.lastY = event.clientY
    }
    const up = (event: PointerEvent) => {
      if (press?.id !== event.pointerId) return
      if (!press.dragged && performance.now() - press.at < CLICK_MS) useNavigationStore.getState().requestPoint(event.clientX, event.clientY)
      press = null
      canvas.style.cursor = ''
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    }
    const cancel = () => {
      press = null
      canvas.style.cursor = ''
    }
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', cancel)
    return () => {
      unsubscribe()
      useNavigationStore.getState().cancel()
      canvas.style.cursor = ''
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', cancel)
    }
  }, [active, touch, camera, scene, gl, ray, artworks, garden])

  // A ring on the floor where the walk ends (above the garden's stepping
  // stones); the raycast looks through it.
  if (!destination) return null
  return (
    <mesh position={[destination.x, 0.07, destination.z]} rotation={[-Math.PI / 2, 0, 0]} userData={{ navigationMarker: true }}>
      <ringGeometry args={[0.18, 0.25, 32]} />
      <meshBasicMaterial color="#e4b84a" depthWrite={false} />
    </mesh>
  )
}
