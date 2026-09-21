'use client'

import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera, useKeyboardControls } from '@react-three/drei'
import { CapsuleCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { useInteractionStore } from '../interaction/store'
import type { Controls } from './controls'

const WALK_SPEED = 3
const RUN_SPEED = 6
const PLAYER_RADIUS = 0.35
const PLAYER_HALF_HEIGHT = 0.5
const EYE_HEIGHT_OFFSET = 0.75
const SPAWN_POSITION: [number, number, number] = [0, 0.9, 3]

const UP = new THREE.Vector3(0, 1, 0)

export function Player({ active }: { active: boolean }) {
  const bodyRef = useRef<RapierRigidBody>(null)
  const getKeys = useKeyboardControls<Controls>()[1]
  const camera = useThree((state) => state.camera)

  const forward = useRef(new THREE.Vector3())
  const right = useRef(new THREE.Vector3())
  const moveDirection = useRef(new THREE.Vector3())

  useFrame(() => {
    const body = bodyRef.current
    if (!body) return

    const modalOpen = useInteractionStore.getState().openId !== null
    if (!active || modalOpen) {
      const velocity = body.linvel()
      body.setLinvel({ x: 0, y: velocity.y, z: 0 }, true)
      return
    }

    const { forward: goForward, backward, left, right: goRight, run } = getKeys()

    camera.getWorldDirection(forward.current)
    forward.current.y = 0
    forward.current.normalize()
    right.current.crossVectors(forward.current, UP).normalize()

    moveDirection.current.set(0, 0, 0)
    if (goForward) moveDirection.current.add(forward.current)
    if (backward) moveDirection.current.sub(forward.current)
    if (goRight) moveDirection.current.add(right.current)
    if (left) moveDirection.current.sub(right.current)
    if (moveDirection.current.lengthSq() > 0) moveDirection.current.normalize()

    const speed = run ? RUN_SPEED : WALK_SPEED
    const velocity = body.linvel()
    body.setLinvel(
      { x: moveDirection.current.x * speed, y: velocity.y, z: moveDirection.current.z * speed },
      true,
    )
  })

  return (
    <RigidBody ref={bodyRef} position={SPAWN_POSITION} type="dynamic" colliders={false} lockRotations>
      <CapsuleCollider args={[PLAYER_HALF_HEIGHT, PLAYER_RADIUS]} />
      <PerspectiveCamera makeDefault fov={70} near={0.05} position={[0, EYE_HEIGHT_OFFSET, 0]} />
    </RigidBody>
  )
}
