'use client'

import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Artwork } from '@/data/artworks'
import type { Controls } from '../player/controls'
import { useInteractionStore } from './store'

const MAX_DISTANCE = 3.5
// Half-angle cone of "looking at it", as a dot-product threshold (~45.6°).
const MIN_DOT = 0.7

const cameraPosition = new THREE.Vector3()
const cameraForward = new THREE.Vector3()
const toArtwork = new THREE.Vector3()

export function InteractionManager({ artworks }: { artworks: Artwork[] }) {
  const camera = useThree((state) => state.camera)
  const subscribeKeys = useKeyboardControls<Controls>()[0]

  useFrame(() => {
    camera.getWorldPosition(cameraPosition)
    camera.getWorldDirection(cameraForward)

    let nearestId: string | null = null
    let nearestDistance = Infinity

    for (const artwork of artworks) {
      toArtwork.set(...artwork.position).sub(cameraPosition)
      const distance = toArtwork.length()
      if (distance === 0 || distance > MAX_DISTANCE || distance > nearestDistance) continue
      toArtwork.normalize()
      if (cameraForward.dot(toArtwork) < MIN_DOT) continue
      nearestId = artwork.id
      nearestDistance = distance
    }

    useInteractionStore.getState().setTarget(nearestId)
  })

  // Rising edge only — holding E must not reopen/spam the modal every frame.
  // E also closes an open modal: ESC always exits Pointer Lock too (the
  // browser reserves that, no way around it), so E is the way to close a
  // piece and keep walking without dropping back to the pause screen.
  useEffect(() => {
    return subscribeKeys(
      (state) => state.interact,
      (pressed) => {
        if (pressed) useInteractionStore.getState().toggle()
      },
    )
  }, [subscribeKeys])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code === 'Escape') useInteractionStore.getState().close()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return null
}
