'use client'

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { CanvasTexture, MeshStandardMaterial, Raycaster, SRGBColorSpace, Vector2 } from 'three'
import { DOOR_HEIGHT, DOOR_WIDTH, WALL_THICKNESS, type GalleryRoomTemplate } from '../world/roomsData'
import { useClubDoorStore } from './store'

export type ClubDoorLabels = {
  /** «SIGUIENTE SALA» */
  next: string
  /** While the Club has no other gallery to lead to. */
  soon: string
  countryName: (code: string) => string
}

const MAX_DISTANCE = 3.5

// The Puerta al Club: a closed double door in the room's way in, with a
// plaque above it naming the next gallery. Looking at it from close by, E
// (or the touch button) goes there (interaction/interact.ts). It also closes
// the opening, which used to look out onto nothing.
export function ClubDoor({ template, active, labels }: { template: GalleryRoomTemplate; active: boolean; labels: ClubDoorLabels }) {
  const entrance = template.doorways[0]
  const plaque = useRef<MeshStandardMaterial>(null)
  const ray = useRef(new Raycaster())
  const next = useClubDoorStore((state) => state.next)

  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 256
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#efe6d2'
    ctx.fillRect(0, 0, 1024, 256)
    ctx.strokeStyle = '#2a211a'
    ctx.lineWidth = 10
    ctx.strokeRect(14, 14, 996, 228)
    ctx.fillStyle = '#c8321f'
    ctx.textAlign = 'center'
    ctx.font = 'bold 44px sans-serif'
    ctx.fillText(labels.next.toUpperCase(), 512, 80)
    ctx.fillStyle = '#20190f'
    const name = next?.artistName ?? labels.soon
    let size = 76
    do { ctx.font = `bold ${size}px sans-serif`; size -= 4 } while (ctx.measureText(name).width > 940 && size > 30)
    ctx.fillText(name, 512, 165)
    if (next?.countryCode) {
      ctx.font = '38px sans-serif'
      ctx.fillText(labels.countryName(next.countryCode), 512, 220)
    }
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 4
    if (plaque.current) { plaque.current.map = texture; plaque.current.needsUpdate = true }
    return () => texture.dispose()
  }, [next, labels])

  useFrame(({ camera, scene }) => {
    let aiming = false
    if (active && next) {
      ray.current.setFromCamera(new Vector2(0, 0), camera)
      const hit = ray.current.intersectObjects(scene.children, true).find(({ object }) => !object.userData.navigationMarker)
      if (hit && hit.distance <= MAX_DISTANCE) {
        for (let object = hit.object; object; object = object.parent!) if (object.userData.clubDoor) aiming = true
      }
    }
    if (useClubDoorStore.getState().aiming !== aiming) useClubDoorStore.getState().setAiming(aiming)
  })
  useEffect(() => () => useClubDoorStore.setState({ aiming: false }), [])

  if (!entrance || entrance.axis !== 'x') return null
  const [x, , z] = entrance.center
  // The room lies on the side of the doorway nearer the template's centre.
  const inward = z > (template.bounds[1] + template.bounds[3]) / 2 ? -1 : 1
  const face = inward * (WALL_THICKNESS / 2 + 0.01)
  const leaf = DOOR_WIDTH / 2 - 0.04

  return (
    <RigidBody type="fixed" colliders={false} position={[x, 0, z]}>
      <CuboidCollider args={[DOOR_WIDTH / 2, DOOR_HEIGHT / 2, WALL_THICKNESS / 2]} position={[0, DOOR_HEIGHT / 2, 0]} />
      <group userData={{ clubDoor: true }} rotation={[0, inward > 0 ? 0 : Math.PI, 0]}>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * (leaf / 2 + 0.02), DOOR_HEIGHT / 2, Math.abs(face) - 0.06]}>
            <mesh castShadow receiveShadow><boxGeometry args={[leaf, DOOR_HEIGHT - 0.04, 0.07]} /><meshStandardMaterial color="#6b4428" roughness={0.7} /></mesh>
            {[0.55, -0.45].map((y) => (
              <mesh key={y} position={[0, y, 0.04]}><boxGeometry args={[leaf - 0.28, 0.8, 0.02]} /><meshStandardMaterial color="#5a3820" roughness={0.75} /></mesh>
            ))}
            <mesh position={[-side * (leaf / 2 - 0.12), -0.05, 0.07]}><sphereGeometry args={[0.045, 12, 8]} /><meshStandardMaterial color="#c9a44a" metalness={0.8} roughness={0.3} /></mesh>
          </group>
        ))}
        <mesh position={[0, DOOR_HEIGHT + 0.05, Math.abs(face)]}><boxGeometry args={[DOOR_WIDTH + 0.2, 0.1, 0.05]} /><meshStandardMaterial color="#2a211a" /></mesh>
        <mesh position={[0, DOOR_HEIGHT + 0.42, Math.abs(face) + 0.01]}>
          <planeGeometry args={[1.8, 0.45]} />
          <meshStandardMaterial ref={plaque} roughness={0.6} emissive="#fff6dd" emissiveIntensity={0.08} />
        </mesh>
      </group>
    </RigidBody>
  )
}
