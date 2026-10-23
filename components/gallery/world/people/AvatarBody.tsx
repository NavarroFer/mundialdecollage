'use client'

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { walkRate } from './avatarMotion'
import { animationsUrl, avatarUrl, crouchUrl, type CastMember } from './cast'
import type { Gait } from './Person'

/**
 * A cast member's real body, walking, standing or squatting as the walker says. It
 * suspends while its files download (Person shows the drawn figure meanwhile)
 * and throws if they can't, which AvatarFallback catches.
 */
export function AvatarBody({ member, gait, phase }: { member: CastMember; gait: RefObject<Gait>; phase: number }) {
  // Meshopt-compressed, no Draco: useGLTF caches each file, so a body shared by two people downloads once.
  const { scene } = useGLTF(avatarUrl(member.name), false, true)
  const { animations } = useGLTF(animationsUrl(member.sex), false, true)

  const body = useMemo(() => {
    const copy = clone(scene)
    // GLTFLoader gives each piece (one per material) its own skeleton; one per person is enough.
    let skeleton: THREE.Skeleton | undefined
    copy.traverse((object) => {
      const mesh = object as THREE.SkinnedMesh
      if (!mesh.isMesh) return
      if (mesh.isSkinnedMesh) {
        if (!skeleton) skeleton = mesh.skeleton
        else mesh.bind(skeleton, mesh.bindMatrix)
      }
      mesh.castShadow = true
      // A skinned mesh's bounds are its rest pose, so culling could hide someone mid-stride.
      mesh.frustumCulled = false
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials) {
        // Hair, lashes and brows: cut out instead of blended, so they never sort wrong, with soft edges from MSAA.
        if (material.transparent) {
          material.transparent = false
          material.alphaTest = 0.5
          material.alphaToCoverage = true
        }
      }
    })
    return copy
  }, [scene])

  const mixer = useMemo(() => new THREE.AnimationMixer(body), [body])
  const actions = useMemo(() => {
    const clip = (name: string) => animations.find((animation) => animation.name === name)!
    return { walk: mixer.clipAction(clip('walk')), idle: mixer.clipAction(clip('idle')) }
  }, [mixer, animations])

  useEffect(() => {
    // Both always play; their weights cross-fade. Offset so people don't move in step.
    actions.idle.play()
    actions.walk.play()
    actions.walk.setEffectiveWeight(0)
    mixer.setTime(phase)
    return () => { mixer.stopAllAction() }
  }, [actions, mixer, phase])

  // Fetched the first time this person squats or hops: the scripted visitors never do.
  const [crouchWanted, wantCrouch] = useState(false)
  const crouch = useRef<THREE.AnimationAction | null>(null)
  const walking = useRef(0)
  const speed = useRef(0)
  useFrame((_, frameDelta) => {
    const delta = Math.min(frameDelta, 0.05)
    const { moving, speed: current } = gait.current
    if (!crouchWanted && gait.current.crouch > 0) wantCrouch(true)
    walking.current = THREE.MathUtils.damp(walking.current, moving ? 1 : 0, 6, delta)
    speed.current = THREE.MathUtils.damp(speed.current, current, 4, delta)
    // Until the crouch loads (or if it never does) they stay standing; a hop still shows.
    const down = crouch.current ? gait.current.crouch : 0
    crouch.current?.setEffectiveWeight(down)
    actions.walk.setEffectiveWeight(walking.current * (1 - down))
    actions.idle.setEffectiveWeight((1 - walking.current) * (1 - down))
    actions.walk.setEffectiveTimeScale(walkRate(speed.current, member.sex))
    mixer.update(delta)
  })

  return (
    <>
      <primitive object={body} />
      {crouchWanted && (
        <AvatarFallback fallback={null}>
          <Suspense fallback={null}><CrouchClip sex={member.sex} mixer={mixer} actionRef={crouch} /></Suspense>
        </AvatarFallback>
      )}
    </>
  )
}

/** Adds the squat to a body's mixer once its file arrives. */
function CrouchClip({ sex, mixer, actionRef }: { sex: CastMember['sex']; mixer: THREE.AnimationMixer; actionRef: RefObject<THREE.AnimationAction | null> }) {
  const { animations } = useGLTF(crouchUrl(sex), false, true)
  useEffect(() => {
    const action = mixer.clipAction(animations[0])
    action.setEffectiveWeight(0)
    action.play()
    actionRef.current = action
    return () => {
      action.stop()
      actionRef.current = null
    }
  }, [animations, mixer, actionRef])
  return null
}

/** Shows the drawn figure for good when a body can't load (offline, a missing file, R2 throttling). */
export class AvatarFallback extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
