'use client'

import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { usePlayerTrackerStore } from './store'

// A minimap dot doesn't need 60fps precision — updating it ~12x/second
// keeps the store (and the DOM it drives) quiet without looking choppy.
const UPDATE_INTERVAL = 1 / 12

const worldPosition = new THREE.Vector3()
const worldDirection = new THREE.Vector3()

export function PlayerTracker() {
  const camera = useThree((state) => state.camera)
  const elapsed = useRef(0)

  useFrame((_, delta) => {
    elapsed.current += delta
    if (elapsed.current < UPDATE_INTERVAL) return
    elapsed.current = 0

    camera.getWorldPosition(worldPosition)
    camera.getWorldDirection(worldDirection)
    const heading = Math.atan2(worldDirection.x, -worldDirection.z)

    usePlayerTrackerStore.getState().setPose(worldPosition.x, worldPosition.z, heading)
  })

  return null
}
