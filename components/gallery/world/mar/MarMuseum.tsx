'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import type { DirectionalLight } from 'three'
import { PRESETS } from '../../graphics/quality'
import { useGraphics } from '../../graphics/store'
import { playerBody } from '../../player/body'
import { SPAWN_HEIGHT } from '../../player/spawn'
import {
  MAR,
  MAR_ESCALATORS,
  blocksBody,
  marBoxes,
  marCenter,
  marEscalatorHeight,
  marFloors,
  marSize,
  type MarBox,
  type MarKind,
} from './layout'
import { cobbleTexture, concreteTexture, escalatorTexture } from './textures'

// BoxGeometry face order: +x, -x, +y, -y, +z, -z. Each face's UVs run 0..1
// across that face, so scaling them by the face size tiles one panel module.
function tileBox(geometry: THREE.BoxGeometry, size: [number, number, number], tileX: number, tileY: number) {
  const uv = geometry.getAttribute('uv')
  const scales: Array<[number, number]> = [
    [size[2] / tileX, size[1] / tileY],
    [size[2] / tileX, size[1] / tileY],
    [size[0] / tileX, size[2] / tileY],
    [size[0] / tileX, size[2] / tileY],
    [size[0] / tileX, size[1] / tileY],
    [size[0] / tileX, size[1] / tileY],
  ]
  for (let face = 0; face < 6; face++) {
    const [su, sv] = scales[face]
    for (let i = 0; i < 4; i++) {
      const index = face * 4 + i
      uv.setXY(index, uv.getX(index) * su, uv.getY(index) * sv)
    }
  }
  uv.needsUpdate = true
}

function tiledPlane(width: number, depth: number, tile: number) {
  const geometry = new THREE.PlaneGeometry(width, depth)
  const uv = geometry.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (width / tile), uv.getY(i) * (depth / tile))
  uv.needsUpdate = true
  return geometry
}

function useBoxGeometries(boxes: MarBox[], tile: boolean) {
  const geometries = useMemo(() => boxes.map((item) => {
    const size = marSize(item)
    const geometry = new THREE.BoxGeometry(size[0], size[1], size[2])
    if (tile) tileBox(geometry, size, MAR.panel.width, MAR.panel.height)
    return geometry
  }), [boxes, tile])
  useEffect(() => () => geometries.forEach((geometry) => geometry.dispose()), [geometries])
  return geometries
}

function KindMeshes({ kind, material, tile = false, cast = true }: { kind: MarKind; material: THREE.Material; tile?: boolean; cast?: boolean }) {
  const boxes = useMemo(() => marBoxes.filter((item) => item.kind === kind && item.visual !== false), [kind])
  const geometries = useBoxGeometries(boxes, tile)
  return geometries.map((geometry, index) => (
    <mesh key={boxes[index].id} geometry={geometry} position={marCenter(boxes[index])} material={material} castShadow={cast} receiveShadow />
  ))
}

function MarLights() {
  const quality = useGraphics((state) => state.current)
  const mobile = useGraphics((state) => state.mobile)
  const gl = useThree((state) => state.gl)
  const invalidate = useThree((state) => state.invalidate)
  const light = useRef<DirectionalLight>(null)
  const mapSize = Math.min(PRESETS[quality].shadows, mobile ? 2048 : 4096, gl.capabilities.maxTextureSize)
  useEffect(() => {
    if (!light.current) return
    const shadow = light.current.shadow
    shadow.map?.dispose()
    shadow.map = null
    shadow.needsUpdate = true
    invalidate()
  }, [mapSize, invalidate])
  const low = quality === 'low'
  return (
    <>
      <hemisphereLight color="#d5ebff" groundColor="#c4bfb4" intensity={0.9} />
      <ambientLight intensity={0.32} color="#fffaf4" />
      <directionalLight
        ref={light}
        position={[6, 32, 40]}
        intensity={1.9}
        color="#fff6e8"
        castShadow={mapSize > 0}
        shadow-mapSize={[Math.max(1, mapSize), Math.max(1, mapSize)]}
        shadow-camera-left={-46}
        shadow-camera-right={46}
        shadow-camera-top={46}
        shadow-camera-bottom={-46}
        shadow-camera-near={1}
        shadow-camera-far={96}
        shadow-bias={-0.00035}
        shadow-normalBias={0.045}
        shadow-radius={2}
      />
      <pointLight position={[0, 6.6, -8]} intensity={low ? 16 : 26} distance={26} decay={2} color="#fff1dc" />
      <pointLight position={[-20, 4.1, -1]} intensity={low ? 10 : 20} distance={18} decay={2} color="#fffaf2" />
      <pointLight position={[23, 4.4, -13]} intensity={low ? 5 : 9} distance={15} decay={2} color="#d5e2ff" />
      {!low && <pointLight position={[2, 5.4, -29]} intensity={12} distance={18} decay={2} color="#ffe6c4" />}
    </>
  )
}

/**
 * Walks the escalator by lifting the body along the slope. The deck has no solid, so nothing blocks the way up.
 * No priority argument: a positive one tells R3F this hook renders the frame itself, and the canvas stays blank.
 */
function EscalatorRide() {
  useFrame(() => {
    const body = playerBody.current
    if (!body) return
    const position = body.translation()
    const height = marEscalatorHeight(position.x, position.z)
    if (height == null) return
    body.setTranslation({ x: position.x, y: height + SPAWN_HEIGHT, z: position.z }, true)
    const velocity = body.linvel()
    body.setLinvel({ x: velocity.x, y: 0, z: velocity.z }, true)
  })
  return null
}

function MarSign() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 200
    const context = canvas.getContext('2d')!
    context.clearRect(0, 0, 640, 200)
    context.fillStyle = '#f7f4ee'
    context.font = '700 168px Arial, Helvetica, sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText('MAR', 320, 108)
    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    return map
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  // Stand-in lettering on the right volume's plaza face. Not a traced logo.
  return (
    <mesh position={[18, 6.15, 5.66]}>
      <planeGeometry args={[6.2, 1.95]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  )
}

function EscalatorDecks({ material }: { material: THREE.Material }) {
  const meshes = useMemo(() => MAR_ESCALATORS.map((lane) => {
    const run = lane.zBottom - lane.zTop
    const length = Math.hypot(run, lane.rise)
    const geometry = new THREE.BoxGeometry(lane.x1 - lane.x0, 0.08, length)
    const uv = geometry.getAttribute('uv')
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * (length / 0.45))
    uv.needsUpdate = true
    return { geometry, lane, length }
  }), [])
  useEffect(() => () => meshes.forEach(({ geometry }) => geometry.dispose()), [meshes])
  return meshes.map(({ geometry, lane }) => (
    <mesh
      key={lane.id}
      geometry={geometry}
      material={material}
      position={[(lane.x0 + lane.x1) / 2, lane.rise / 2, (lane.zBottom + lane.zTop) / 2]}
      rotation={[Math.atan2(lane.rise, lane.zBottom - lane.zTop), 0, 0]}
      receiveShadow
    />
  ))
}

function Floors({ materials }: { materials: Record<(typeof marFloors)[number]['kind'], THREE.Material> }) {
  const geometries = useMemo(() => marFloors.map((floor) => {
    const tile = floor.kind === 'cobble' ? MAR.cobble : floor.kind === 'grass' ? 4 : 3
    return tiledPlane(floor.x1 - floor.x0, floor.z1 - floor.z0, tile)
  }), [])
  useEffect(() => () => geometries.forEach((geometry) => geometry.dispose()), [geometries])
  return geometries.map((geometry, index) => {
    const floor = marFloors[index]
    return (
      <mesh key={floor.id} geometry={geometry} material={materials[floor.kind]} position={[(floor.x0 + floor.x1) / 2, 0.02, (floor.z0 + floor.z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />
    )
  })
}

const TREES: Array<[number, number]> = [[-32, 26], [-18, 28], [6, 27], [22, 26], [34, 23]]

/**
 * Walkable model of Museo MAR: plaza, glazed entrance, double-height hall,
 * mezzanine, two exhibition rooms and the auditorium. Colliders are the boxes
 * in layout.ts, not a triangle mesh of the visuals, so a window cannot become
 * a hidden wall and the entrance stays a real opening.
 */
export function MarMuseum() {
  const materials = useMemo(() => {
    const concreteMap = concreteTexture()
    const cobbleMap = cobbleTexture()
    const stepMap = escalatorTexture()
    return {
      concreteMap,
      cobbleMap,
      stepMap,
      concrete: new THREE.MeshStandardMaterial({ map: concreteMap, roughness: 0.92, metalness: 0.02 }),
      deck: new THREE.MeshStandardMaterial({ color: '#b7b3ac', roughness: 0.78 }),
      white: new THREE.MeshStandardMaterial({ color: '#f4f3ef', roughness: 0.9 }),
      glass: new THREE.MeshStandardMaterial({ color: '#c5d7e4', transparent: true, opacity: 0.22, roughness: 0.08, metalness: 0.12, side: THREE.DoubleSide, depthWrite: false }),
      mullion: new THREE.MeshStandardMaterial({ color: '#1c1e21', roughness: 0.45, metalness: 0.35 }),
      distant: new THREE.MeshStandardMaterial({ color: '#d5cfc4', roughness: 0.9 }),
      seat: new THREE.MeshStandardMaterial({ color: '#6d5348', roughness: 0.86 }),
      table: new THREE.MeshStandardMaterial({ color: '#8d9294', roughness: 0.55, metalness: 0.2 }),
      curb: new THREE.MeshStandardMaterial({ color: '#9aa07a', roughness: 0.95 }),
      trunk: new THREE.MeshStandardMaterial({ color: '#6b5344', roughness: 0.9 }),
      cobble: new THREE.MeshStandardMaterial({ map: cobbleMap, roughness: 0.96 }),
      grass: new THREE.MeshStandardMaterial({ color: '#7ea36a', roughness: 1 }),
      polish: new THREE.MeshStandardMaterial({ color: '#9aa0a4', roughness: 0.32, metalness: 0.08 }),
      gallery: new THREE.MeshStandardMaterial({ color: '#d5d3ce', roughness: 0.55 }),
      dark: new THREE.MeshStandardMaterial({ color: '#6a6e72', roughness: 0.48, metalness: 0.06 }),
      auditorium: new THREE.MeshStandardMaterial({ color: '#8a8178', roughness: 0.7 }),
      ceiling: new THREE.MeshStandardMaterial({ color: '#d9d4cc', roughness: 0.88 }),
      darkCeiling: new THREE.MeshStandardMaterial({ color: '#3e4348', roughness: 0.8 }),
      steps: new THREE.MeshStandardMaterial({ map: stepMap, roughness: 0.72 }),
      leaf: new THREE.MeshStandardMaterial({ color: '#3f6b45', roughness: 0.95 }),
      water: new THREE.MeshStandardMaterial({ color: '#8eb4c6', transparent: true, opacity: 0.55, roughness: 0.15, metalness: 0.05 }),
      sea: new THREE.MeshStandardMaterial({ color: '#7eafc4', roughness: 0.35, metalness: 0.05 }),
      beam: new THREE.MeshStandardMaterial({ color: '#b7b2a8', roughness: 0.8 }),
      lamp: new THREE.MeshStandardMaterial({ color: '#fff6e4', emissive: '#fff1d2', emissiveIntensity: 0.7, roughness: 0.4 }),
    }
  }, [])
  useEffect(() => () => {
    materials.concreteMap.dispose()
    materials.cobbleMap.dispose()
    materials.stepMap.dispose()
    for (const value of Object.values(materials)) if (value instanceof THREE.Material) value.dispose()
  }, [materials])

  const floorMaterials = {
    cobble: materials.cobble,
    grass: materials.grass,
    polish: materials.polish,
    gallery: materials.gallery,
    dark: materials.dark,
    auditorium: materials.auditorium,
  }

  return (
    <group>
      <MarLights />
      <EscalatorRide />
      <RigidBody type="fixed" colliders={false} friction={1}>
        <CuboidCollider args={[38, 0.25, 37]} position={[2, -0.25, -5]} />
        {marBoxes.filter(blocksBody).map((item) => {
          const [width, height, depth] = marSize(item)
          return <CuboidCollider key={item.id} args={[width / 2, height / 2, depth / 2]} position={marCenter(item)} />
        })}
      </RigidBody>

      <Floors materials={floorMaterials} />
      <KindMeshes kind="concrete" material={materials.concrete} tile cast />
      <KindMeshes kind="deck" material={materials.deck} />
      <KindMeshes kind="white" material={materials.white} />
      <KindMeshes kind="glass" material={materials.glass} cast={false} />
      <KindMeshes kind="mullion" material={materials.mullion} cast={false} />
      <KindMeshes kind="distant" material={materials.distant} cast={false} />
      <KindMeshes kind="seat" material={materials.seat} />
      <KindMeshes kind="table" material={materials.table} />
      <KindMeshes kind="curb" material={materials.curb} />
      <KindMeshes kind="trunk" material={materials.trunk} />

      <mesh position={[1, MAR.hallHeight, -10]} rotation={[Math.PI / 2, 0, 0]} material={materials.ceiling}>
        <planeGeometry args={[26, 20]} />
      </mesh>
      <mesh position={[-21, MAR.westInterior, -2]} rotation={[Math.PI / 2, 0, 0]} material={materials.ceiling}>
        <planeGeometry args={[17.6, 19.6]} />
      </mesh>
      <mesh position={[23, MAR.eastInterior, -13]} rotation={[Math.PI / 2, 0, 0]} material={materials.darkCeiling}>
        <planeGeometry args={[17.6, 9.6]} />
      </mesh>
      <mesh position={[4, MAR.auditorium, -29]} rotation={[Math.PI / 2, 0, 0]} material={materials.ceiling}>
        <planeGeometry args={[23.6, 17.6]} />
      </mesh>
      {[-16, -12, -8, -4].map((z) => (
        <mesh key={z} position={[1, 8.72, z]} material={materials.beam} castShadow>
          <boxGeometry args={[24, 0.22, 0.18]} />
        </mesh>
      ))}
      {[-16, -6].map((x) => (
        <mesh key={x} position={[x, 4.95, -2]} material={materials.lamp}>
          <boxGeometry args={[0.12, 0.08, 8]} />
        </mesh>
      ))}
      {[-16, -13, -10].map((z) => (
        <mesh key={z} position={[23, 5.35, z]} material={materials.lamp}>
          <boxGeometry args={[12, 0.08, 0.16]} />
        </mesh>
      ))}

      <EscalatorDecks material={materials.steps} />
      <MarSign />
      {/* Upper window band on the volume that projects over the plaza. */}
      <mesh position={[-20, 7.9, 12.22]} material={materials.glass}>
        <planeGeometry args={[9.5, 1.35]} />
      </mesh>

      <mesh position={[-22, 0.08, 16]} rotation={[-Math.PI / 2, 0, 0]} material={materials.water}>
        <planeGeometry args={[10.4, 6.6]} />
      </mesh>
      <mesh position={[0, -0.2, 78]} rotation={[-Math.PI / 2, 0, 0]} material={materials.sea}>
        <planeGeometry args={[180, 90]} />
      </mesh>
      {TREES.map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 3.3, z]} material={materials.leaf} castShadow>
          <sphereGeometry args={[1.7, 12, 10]} />
        </mesh>
      ))}
    </group>
  )
}
