'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Raycaster, Vector2, Vector3 } from 'three'
import type { Artwork } from '@/data/artworks'
import { aimAt } from '../navigation/aim'
import { tapHintCandidates } from './tapHint'
import { useTapHintStore } from './tapHintStore'

// How often to choose the obra again; in between, the hint just follows it.
const PICK_MS = 300
// Less than this on screen isn't worth moving the hint for.
const STILL_PX = 0.5

const pointer = new Vector2()
const center = new Vector3()

/**
 * While the first-visit hint is up, finds the obra it points at: the nearest
 * in clear view, where a tap on its center would open it (the same aim as a
 * real tap, PointNavigation's). It keeps the one it has while it stays in
 * view, so the hint doesn't hop between two, and says where it is on screen
 * every frame.
 */
export function TapHintTracker({ artworks }: { artworks: Artwork[] }) {
  const { camera, scene, size } = useThree()
  const ray = useMemo(() => new Raycaster(), [])
  const target = useRef<Artwork | null>(null)
  const pickedAt = useRef(-Infinity)

  useFrame(() => {
    const hint = useTapHintStore.getState()
    if (!hint.active) {
      target.current = null
      pickedAt.current = -Infinity
      return
    }

    const now = performance.now()
    if (now - pickedAt.current >= PICK_MS) {
      pickedAt.current = now
      const inClearView = ({ id, x, y }: { id: string; x: number; y: number }) => {
        ray.setFromCamera(pointer.set(x, y), camera)
        const aim = aimAt(ray.intersectObjects(scene.children, true))
        return aim?.kind === 'artwork' && aim.id === id
      }
      const candidates = tapHintCandidates(artworks, camera)
      const current = candidates.find(({ id }) => id === target.current?.id)
      const picked = current && inClearView(current) ? current : candidates.find((candidate) => candidate !== current && inClearView(candidate))
      target.current = picked ? artworks.find(({ id }) => id === picked.id) ?? null : null
    }

    if (!target.current) {
      if (hint.spot) useTapHintStore.setState({ spot: null })
      return
    }
    center.set(...target.current.position).project(camera)
    const x = ((center.x + 1) / 2) * size.width
    const y = ((1 - center.y) / 2) * size.height
    if (hint.spot && Math.abs(hint.spot.x - x) < STILL_PX && Math.abs(hint.spot.y - y) < STILL_PX) return
    useTapHintStore.setState({ spot: { x, y } })
  })

  return null
}
