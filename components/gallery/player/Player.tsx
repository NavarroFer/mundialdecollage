'use client'

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { PerspectiveCamera, useKeyboardControls } from '@react-three/drei'
import { CapsuleCollider, RigidBody, useRapier, type RapierCollider, type RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import type { Artwork } from '@/data/artworks'
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
// About half a metre of hop under Rapier's default gravity (v = √(2gh)).
const JUMP_SPEED = 3.2
// Capsule centre to its bottom is the same standing or crouched (the
// collider shifts down as it shrinks), plus a little slack for the ground.
const GROUND_PROBE = PLAYER_HALF_HEIGHT + PLAYER_RADIUS + 0.05
// The camera initially looks toward -Z. Start in front of the central bench
// (at z=2.25), with room to walk forward into the gallery.
const SPAWN_POSITION: [number, number, number] = [0, 0.9, -0.5]

const UP = new THREE.Vector3(0, 1, 0)
const focusWorldPosition = new THREE.Vector3()
const focusLocalPosition = new THREE.Vector3()
const focusTarget = new THREE.Vector3()
const focusRotationMatrix = new THREE.Matrix4()
const focusQuaternion = new THREE.Quaternion()

export function Player({ active, artworks }: { active: boolean; artworks: Artwork[] }) {
  const bodyRef = useRef<RapierRigidBody>(null)
  const colliderRef = useRef<RapierCollider>(null)
  const crouchHeld = useRef(false)
  const jumpRequested = useRef(false)
  const { world, rapier } = useRapier()
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
    const requestJump = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return
      if (useInteractionStore.getState().openId !== null) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      // Keep Space from scrolling the page or re-clicking a focused button.
      event.preventDefault()
      jumpRequested.current = true
    }
    const reset = () => { crouchHeld.current = false }
    window.addEventListener('keydown', updateControl)
    window.addEventListener('keydown', requestJump)
    window.addEventListener('keyup', updateControl)
    window.addEventListener('blur', reset)
    return () => {
      reset()
      window.removeEventListener('keydown', updateControl)
      window.removeEventListener('keydown', requestJump)
      window.removeEventListener('keyup', updateControl)
      window.removeEventListener('blur', reset)
    }
  }, [active])

  useFrame(({ camera }, delta) => {
    const body = bodyRef.current
    if (!body) return

    const openId = useInteractionStore.getState().openId
    const modalOpen = openId !== null
    const focusedArtwork = modalOpen ? artworks.find((artwork) => artwork.id === openId) : undefined

    if (focusedArtwork) {
      const rotationY = focusedArtwork.rotation[1]
      const viewingDistance = Math.max(focusedArtwork.width, focusedArtwork.height) * 0.62 + 0.75
      focusTarget.set(...focusedArtwork.position)
      focusWorldPosition.set(
        focusedArtwork.position[0] + Math.sin(rotationY) * viewingDistance,
        focusedArtwork.position[1],
        focusedArtwork.position[2] + Math.cos(rotationY) * viewingDistance,
      )
      const bodyPosition = body.translation()
      focusLocalPosition.set(
        focusWorldPosition.x - bodyPosition.x,
        focusWorldPosition.y - bodyPosition.y,
        focusWorldPosition.z - bodyPosition.z,
      )
      camera.position.x = THREE.MathUtils.damp(camera.position.x, focusLocalPosition.x, 5.5, delta)
      camera.position.y = THREE.MathUtils.damp(camera.position.y, focusLocalPosition.y, 5.5, delta)
      camera.position.z = THREE.MathUtils.damp(camera.position.z, focusLocalPosition.z, 5.5, delta)
      focusRotationMatrix.lookAt(focusWorldPosition, focusTarget, UP)
      focusQuaternion.setFromRotationMatrix(focusRotationMatrix)
      camera.quaternion.slerp(focusQuaternion, 1 - Math.exp(-6 * delta))
    } else {
      camera.position.x = THREE.MathUtils.damp(camera.position.x, 0, 8, delta)
      camera.position.z = THREE.MathUtils.damp(camera.position.z, 0, 8, delta)
    }
    const crouching = active && !modalOpen && crouchHeld.current
    if (!focusedArtwork) {
      camera.position.y = THREE.MathUtils.damp(
        camera.position.y,
        EYE_HEIGHT_OFFSET - (crouching ? CROUCH_DROP : 0),
        14,
        delta,
      )
    }
    if (crouching !== wasCrouching.current && colliderRef.current) {
      const halfDrop = crouching ? CROUCH_DROP / 2 : 0
      colliderRef.current.setHalfHeight(PLAYER_HALF_HEIGHT - halfDrop)
      colliderRef.current.setTranslationWrtParent({ x: 0, y: -halfDrop, z: 0 })
      body.wakeUp()
      wasCrouching.current = crouching
    }
    if (!active || modalOpen) {
      jumpRequested.current = false
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
    let velocityY = velocity.y
    if (jumpRequested.current) {
      jumpRequested.current = false
      const origin = body.translation()
      const ray = new rapier.Ray(origin, { x: 0, y: -1, z: 0 })
      const grounded = world.castRay(ray, GROUND_PROBE, true, undefined, undefined, undefined, body) !== null
      if (grounded) velocityY = JUMP_SPEED
    }
    body.setLinvel(
      { x: moveDirection.current.x * speed, y: velocityY, z: moveDirection.current.z * speed },
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
