'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Raycaster, Vector2 } from 'three'
import { attentionArtwork } from './raycast'
import { attentionTarget } from './target'

/** The closest rendered surface must be an artwork image, not a wall/frame. */
export function AttentionRay({ active }: { active: boolean }) {
  const ray = useMemo(() => new Raycaster(undefined, undefined, 0.05, 5), [])
  const center = useMemo(() => new Vector2(0, 0), [])
  const elapsed = useRef(0)
  useEffect(() => () => { attentionTarget.slug = null; attentionTarget.sampledAt = 0 }, [])
  useFrame(({ camera, scene }, delta) => {
    elapsed.current += delta
    if (!active) { attentionTarget.slug = null; return }
    if (elapsed.current < 0.25) return
    elapsed.current = 0
    ray.setFromCamera(center, camera)
    attentionTarget.slug = attentionArtwork(ray.intersectObjects(scene.children, true))
    attentionTarget.sampledAt = performance.now()
  })
  return null
}
