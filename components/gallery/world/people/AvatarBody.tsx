'use client'

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { walkRate } from './avatarMotion'
import { prepareAvatar, type AvatarMaterialSlots, type AvatarOutfit } from './avatarOutfit'
import { animationsUrl, avatarUrl, crouchUrl, type CastMember } from './cast'
import type { Gait } from './Person'

/**
 * A cast member's real body, walking, standing or squatting as the walker says. It
 * suspends while its files download (Person shows the drawn figure meanwhile)
 * and throws if they can't, which AvatarFallback catches.
 */
export function AvatarBody({
  member,
  gait,
  phase,
  outfit,
  materialSlots,
}: {
  member: CastMember
  gait: RefObject<Gait>
  phase: number
  outfit?: AvatarOutfit
  materialSlots?: AvatarMaterialSlots
}) {
  // Meshopt-compressed, no Draco: useGLTF caches each file, so a body shared by two people downloads once.
  const { scene } = useGLTF(avatarUrl(member.name), false, true)
  const { animations } = useGLTF(animationsUrl(member.sex), false, true)

  const prepared = useMemo(() => prepareAvatar(scene, outfit, materialSlots), [scene, outfit, materialSlots])
  const body = prepared.body

  useEffect(() => () => {
    // The weave/normal textures are a tiny shared cache; only the cloned per-avatar materials are owned here.
    prepared.materials.forEach((material) => material.dispose())
  }, [prepared])

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
