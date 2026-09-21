'use client'

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { PerspectiveCamera, useKeyboardControls } from '@react-three/drei'
import { CapsuleCollider, RigidBody, type RapierCollider, type RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { useInteractionStore } from '../interaction/store'
import { useTouchStore } from '../mobile/touchStore'
import type { Controls } from './controls'

const WALK_SPEED = 2.6
const RUN_SPEED = 5.2
const CROUCH_SPEED = 1.3
const CROUCH_DROP = 0.6
const PLAYER_RADIUS = 0.35
const PLAYER_HALF_HEIGHT = 0.5
const EYE_HEIGHT_OFFSET = 0.75
const SPAWN_POSITION: [number, number, number] = [0, 0.9, 3]

const UP = new THREE.Vector3(0, 1, 0)

export function Player({ active }: { active: boolean }) {
  const bodyRef = useRef<RapierRigidBody>(null)
  const colliderRef = useRef<RapierCollider>(null)
  const crouchHeld = useRef(false)
  const wasCrouching = useRef(false)
  const getKeys = useKeyboardControls<Controls>()[1]

  const forward = useRef(new THREE.Vector3())
  const right = useRef(new THREE.Vector3())
  const moveDirection = useRef(new THREE.Vector3())

  useEffect(() => {
    if (!active) return

    const updateControl = (event: KeyboardEvent) => {
      // ctrlKey handles either Control key on macOS and Windows, including
      // keeping one held while releasing the other. Command is not Control.
      crouchHeld.current = event.ctrlKey
      if (event.ctrlKey && useInteractionStore.getState().openId === null) {
        event.preventDefault()
      }
    }
    const reset = () => { crouchHeld.current = false }
    window.addEventListener('keydown', updateControl)
    window.addEventListener('keyup', updateControl)
    window.addEventListener('blur', reset)
    return () => {
      reset()
      window.removeEventListener('keydown', updateControl)
      window.removeEventListener('keyup', updateControl)
      window.removeEventListener('blur', reset)
    }
  }, [active])

  useFrame(({ camera }, delta) => {
    const body = bodyRef.current
    if (!body) return

    const modalOpen = useInteractionStore.getState().openId !== null
    const crouching = active && !modalOpen && crouchHeld.current
    camera.position.y = THREE.MathUtils.damp(
      camera.position.y,
      EYE_HEIGHT_OFFSET - (crouching ? CROUCH_DROP : 0),
      14,
      delta,
    )
    if (crouching !== wasCrouching.current && colliderRef.current) {
      const halfDrop = crouching ? CROUCH_DROP / 2 : 0
      colliderRef.current.setHalfHeight(PLAYER_HALF_HEIGHT - halfDrop)
      colliderRef.current.setTranslationWrtParent({ x: 0, y: -halfDrop, z: 0 })
      body.wakeUp()
      wasCrouching.current = crouching
    }
    if (!active || modalOpen) {
      const velocity = body.linvel()
      body.setLinvel({ x: 0, y: velocity.y, z: 0 }, true)
      return
    }

    const { forward: goForward, backward, left, right: goRight, run } = getKeys()
    const touch = useTouchStore.getState()
    const touchActive = touch.moveX !== 0 || touch.moveZ !== 0

    camera.getWorldDirection(forward.current)
    forward.current.y = 0
    forward.current.normalize()
    right.current.crossVectors(forward.current, UP).normalize()

    let inputX: number
    let inputZ: number
    if (touchActive) {
      inputX = touch.moveX
      inputZ = touch.moveZ
    } else {
      inputX = (goRight ? 1 : 0) - (left ? 1 : 0)
      inputZ = (goForward ? 1 : 0) - (backward ? 1 : 0)
    }

    moveDirection.current.set(0, 0, 0)
    moveDirection.current.addScaledVector(forward.current, inputZ)
    moveDirection.current.addScaledVector(right.current, inputX)
    // Diagonal keyboard input (length √2) still normalizes to 1 like before;
    // an analog joystick pushed only halfway keeps its own smaller magnitude.
    if (moveDirection.current.lengthSq() > 1) moveDirection.current.normalize()

    // The joystick's push distance doubles as a run trigger — no separate
    // mobile run control needed, same as pushing a stick further in a
    // console FPS.
    const speed = crouching
      ? CROUCH_SPEED
      : touchActive
      ? THREE.MathUtils.lerp(WALK_SPEED, RUN_SPEED, Math.min(moveDirection.current.length(), 1))
      : run
        ? RUN_SPEED
        : WALK_SPEED
    const velocity = body.linvel()
    body.setLinvel(
      { x: moveDirection.current.x * speed, y: velocity.y, z: moveDirection.current.z * speed },
      true,
    )
  })

  return (
    <RigidBody ref={bodyRef} position={SPAWN_POSITION} type="dynamic" colliders={false} lockRotations>
      <CapsuleCollider ref={colliderRef} args={[PLAYER_HALF_HEIGHT, PLAYER_RADIUS]} />
      <PerspectiveCamera makeDefault fov={70} near={0.05} position={[0, EYE_HEIGHT_OFFSET, 0]} />
    </RigidBody>
  )
}
