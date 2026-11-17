'use client'

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CAFE_BAR, CAFE_TABLES, GALLERY, HALL_VOID, MAR, SHOP, UPPER_ROOFLIGHT, marBoxes } from './layout'
import {
  boardTexture,
  fasciaTexture,
  grateTexture,
  labTexture,
  meshCeilingTexture,
  slatTexture,
} from './interiorDecals'
import { canvasOf, canvasTexture, seeded } from './textures'
import { cafeEmblemTexture } from './decals'
import { EntranceDetails } from './EntranceDetails'
import { UpperHall } from './UpperHall'

// The ground floor, as the interior photographs show it: a hall under deep
// concrete beams and skylights, stainless escalators, the café and the shop
// under an expanded-metal ceiling, the Laboratorio's black wall, La Isla.
// Walls and counters that people can bump into are boxes in layout.ts; what
// is drawn here is mostly what you look at.

export type InteriorMaterials = {
  steel: THREE.Material
  black: THREE.Material
  mullion: THREE.Material
  glass: THREE.Material
  lamp: THREE.Material
  beam: THREE.Material
}

const HALL = { x0: -12, x1: 14, z0: -20, z1: 0 }

/** Matrices for instanced meshes, set once. */
function useInstances(ref: React.RefObject<THREE.InstancedMesh | null>, items: Array<{ position: [number, number, number]; rotation?: number; scale?: [number, number, number] }>) {
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    items.forEach((item, index) => {
      dummy.position.set(...item.position)
      dummy.rotation.set(0, item.rotation ?? 0, 0)
      dummy.scale.set(...(item.scale ?? [1, 1, 1]))
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [ref, items])
}

/** Narrow rooflights, deep parallel beams and continuous perimeter lighting, from the wide hall photo. */
function HallRoof({ materials }: { materials: InteriorMaterials }) {
  const light = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fff4db', toneMapped: false }), [])
  const rooflight = useMemo(() => new THREE.MeshBasicMaterial({ color: '#e1e8ea', toneMapped: false }), [])
  useEffect(() => () => { light.dispose(); rooflight.dispose() }, [light, rooflight])
  const beams = useMemo(() => Array.from({ length: 8 }, (_, i) => -10.4 + i * 3.4), [])
  const roofY = MAR.hallHeight
  const ringY = roofY - 1.82
  // The lower glazed entrance bay has a real opening above it, not glass
  // placed underneath an opaque slab. Keep the main hall's other bays intact.
  const roofSpan = (x: number) => {
    const end = x < UPPER_ROOFLIGHT.x1 ? UPPER_ROOFLIGHT.z0 : -0.05
    return { center: (-19.75 + end) / 2, length: end + 19.75 }
  }
  return (
    <group>
      {/* Opaque concrete bays with a narrow daylight slit along one edge. */}
      {beams.slice(0, -1).map((x) => (
        <group key={`bay-${x}`}>
          <mesh position={[x + 1.55, roofY + 0.08, roofSpan(x + 1.55).center]} material={materials.beam} receiveShadow>
            <boxGeometry args={[2.3, 0.16, roofSpan(x + 1.55).length]} />
          </mesh>
          <mesh position={[x + 2.85, roofY + 0.01, roofSpan(x + 2.85).center]} rotation={[Math.PI / 2, 0, 0]} material={rooflight}>
            <planeGeometry args={[0.3, roofSpan(x + 2.85).length]} />
          </mesh>
        </group>
      ))}
      {beams.map((x) => (
        <group key={x}>
          <mesh position={[x, roofY - 0.8, roofSpan(x).center]} material={materials.beam} castShadow receiveShadow>
            <boxGeometry args={[0.8, 1.6, roofSpan(x).length]} />
          </mesh>
          {/* Small groups of warm spots tucked under the concrete beams. */}
          {[-17.9, x < UPPER_ROOFLIGHT.x1 ? UPPER_ROOFLIGHT.z0 - 0.5 : -2.1].map((z) => (
            <group key={z} position={[x, roofY - 1.64, z]}>
              <mesh material={materials.mullion}><boxGeometry args={[0.25, 0.035, 0.6]} /></mesh>
              {[-0.19, 0, 0.19].map((dz) => (
                <mesh key={dz} position={[0, -0.025, dz]} rotation={[Math.PI / 2, 0, 0]} material={light}>
                  <circleGeometry args={[0.048, 12]} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ))}
      {/* The roof's luminous outline follows all four walls. */}
      {[HALL.z0 + 0.22, HALL.z1 - 0.22].map((z) => (
        <group key={z} position={[1, ringY, z]}>
          <mesh material={materials.mullion}><boxGeometry args={[25.55, 0.12, 0.14]} /></mesh>
          <mesh position={[0, -0.065, 0]} material={light}><boxGeometry args={[25.55, 0.025, 0.055]} /></mesh>
        </group>
      ))}
      {[HALL.x0 + 0.22, HALL.x1 - 0.22].map((x) => (
        <group key={x} position={[x, ringY, -10]}>
          <mesh material={materials.mullion}><boxGeometry args={[0.14, 0.12, 19.55]} /></mesh>
          <mesh position={[0, -0.065, 0]} material={light}><boxGeometry args={[0.055, 0.025, 19.55]} /></mesh>
        </group>
      ))}
      {/* Slim light rails below the mezzanine, with individual adjustable fixtures. */}
      {[HALL_VOID.z0, HALL_VOID.z1].map((z, index) => {
        const x0 = index === 0 ? -11.7 : HALL_VOID.x0
        const x1 = index === 0 ? 13.7 : 6.5
        return <group key={z}>
          <mesh position={[(x0 + x1) / 2, MAR.mezzanine - 0.29, z]} material={light}>
            <boxGeometry args={[x1 - x0, 0.025, 0.035]} />
          </mesh>
          {Array.from({ length: index === 0 ? 9 : 6 }, (_, i) => (
            <group key={i} position={[x0 + 0.5 + i * (index === 0 ? 2.9 : 2.5), MAR.mezzanine - 0.38, z]}>
              <mesh material={materials.steel}><boxGeometry args={[0.12, 0.07, 0.12]} /></mesh>
              <mesh position={[0, -0.1, 0]} rotation={[0.35, 0, 0]} material={materials.steel}>
                <cylinderGeometry args={[0.065, 0.075, 0.16, 12]} />
              </mesh>
            </group>
          ))}
        </group>
      })}
    </group>
  )
}

function Chandelier({ position, seed }: { position: [number, number, number]; seed: number }) {
  const crystals = useRef<THREE.InstancedMesh>(null)
  const items = useMemo(() => {
    const random = seeded(seed)
    return Array.from({ length: 46 }, () => {
      const tier = random()
      const radius = 0.15 + tier * 0.5
      const angle = random() * Math.PI * 2
      return { position: [Math.cos(angle) * radius, -tier * 0.55, Math.sin(angle) * radius] as [number, number, number], scale: [1, 1.6, 1] as [number, number, number] }
    })
  }, [seed])
  useInstances(crystals, items)
  return (
    <group position={position}>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.9, 4]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      {[0.25, 0.45, 0.65].map((r, i) => (
        <mesh key={r} position={[0, -i * 0.26, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[r, 0.012, 6, 28]} />
          <meshStandardMaterial color="#2a2a2c" roughness={0.4} metalness={0.5} />
        </mesh>
      ))}
      <instancedMesh ref={crystals} args={[undefined, undefined, items.length]}>
        <sphereGeometry args={[0.035, 6, 5]} />
        <meshStandardMaterial color="#fff3d8" emissive="#ffd9a0" emissiveIntensity={0.9} roughness={0.2} />
      </instancedMesh>
      <pointLight intensity={4} distance={7} decay={2} color="#ffe2b8" position={[0, -0.4, 0]} />
    </group>
  )
}

/** The ceiling over the café and the shop: expanded-metal panels, fluorescent tubes, and a pair of chandeliers. */
function WestCeiling({ materials }: { materials: InteriorMaterials }) {
  const mesh = useMemo(() => {
    const map = meshCeilingTexture()
    map.repeat.set(17.6 / 2.4, 19.6 / 2.4)
    return { map, material: new THREE.MeshStandardMaterial({ map, roughness: 0.7, metalness: 0.2, transparent: true, alphaTest: 0.2, side: THREE.DoubleSide }) }
  }, [])
  useEffect(() => () => {
    mesh.map.dispose()
    mesh.material.dispose()
  }, [mesh])
  return (
    <group>
      <mesh position={[-21, MAR.westInterior - 0.02, -2]} rotation={[Math.PI / 2, 0, 0]} material={mesh.material}>
        <planeGeometry args={[17.6, 19.6]} />
      </mesh>
      {[-9, -5, -1, 3, 6].flatMap((z, row) => [-27, -23, -19, -15].map((x, column) => (
        <mesh key={`${x}:${z}`} position={[x, MAR.westInterior + 0.01, z]}>
          <boxGeometry args={[1.45, 0.045, 0.065]} />
          <meshStandardMaterial color={row % 2 === column % 2 ? '#fff0bd' : '#e7f2ff'} emissive={row % 2 === column % 2 ? '#ffc76c' : '#dceaff'} emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
      )))}
      <Chandelier position={[-24.4, 4.35, 5]} seed={3} />
      <Chandelier position={[-18, 4.35, 0.5]} seed={9} />
    </group>
  )
}

/** Café furniture in metres: 76 cm tables and upholstered wooden medallion chairs. */
function Cafe() {
  const upholstery = useMemo(() => {
    const { canvas, context } = canvasOf(512, 512)
    context.fillStyle = '#c7b99d'
    context.fillRect(0, 0, 512, 512)
    // Small botanical damask motifs, like the cream/brown fabric in the reference.
    for (let row = -1; row < 6; row++) {
      for (let col = -1; col < 6; col++) {
        const x = col * 104 + (row % 2) * 52
        const y = row * 104
        context.save()
        context.translate(x, y)
        context.strokeStyle = '#75604d'
        context.fillStyle = '#89715b'
        context.lineWidth = 2
        for (const side of [-1, 1]) {
          context.beginPath()
          context.moveTo(0, 46)
          context.bezierCurveTo(side * 38, 18, side * 30, -20, 0, -44)
          context.stroke()
          for (let i = 0; i < 5; i++) {
            context.beginPath()
            context.ellipse(side * (12 + Math.sin(i) * 9), 30 - i * 14, 11, 4, side * (0.5 + i * 0.3), 0, Math.PI * 2)
            context.fill()
          }
        }
        for (let petal = 0; petal < 8; petal++) {
          const angle = petal * Math.PI / 4
          context.beginPath()
          context.ellipse(Math.cos(angle) * 10, Math.sin(angle) * 10, 9, 4, angle, 0, Math.PI * 2)
          context.fill()
        }
        context.restore()
      }
    }
    return canvasTexture(canvas)
  }, [])
  useEffect(() => () => upholstery.dispose(), [upholstery])
  const tops = useRef<THREE.InstancedMesh>(null)
  const legs = useRef<THREE.InstancedMesh>(null)
  const seats = useRef<THREE.InstancedMesh>(null)
  const backs = useRef<THREE.InstancedMesh>(null)
  const rims = useRef<THREE.InstancedMesh>(null)
  const chairLegs = useRef<THREE.InstancedMesh>(null)
  const seatFrames = useRef<THREE.InstancedMesh>(null)
  const tableItems = useMemo(() => CAFE_TABLES.map(([x, z]) => ({ position: [x, 0.74, z] as [number, number, number] })), [])
  const legItems = useMemo(() => CAFE_TABLES.flatMap(([x, z]) => [[-0.55, -0.32], [0.55, -0.32], [-0.55, 0.32], [0.55, 0.32]].map(([dx, dz]) => ({ position: [x + dx, 0.37, z + dz] as [number, number, number] }))), [])
  const chairs = useMemo(() => CAFE_TABLES.flatMap(([x, z]) => [
    { position: [x - 0.35, 0, z + 0.62] as [number, number, number], rotation: 0 },
    { position: [x + 0.35, 0, z + 0.62] as [number, number, number], rotation: 0 },
    { position: [x - 0.35, 0, z - 0.62] as [number, number, number], rotation: Math.PI },
    { position: [x + 0.35, 0, z - 0.62] as [number, number, number], rotation: Math.PI },
  ]), [])
  const seatItems = useMemo(() => chairs.map((c) => ({ ...c, position: [c.position[0], 0.46, c.position[2]] as [number, number, number] })), [chairs])
  const backItems = useMemo(() => chairs.map((c) => ({ ...c, position: [c.position[0], 0.79, c.position[2] + (c.rotation === 0 ? 0.2 : -0.2)] as [number, number, number], scale: [0.88, 1.15, 1] as [number, number, number] })), [chairs])
  const legGeometry = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    for (const x of [-0.19, 0.19]) {
      for (const z of [-0.18, 0.18]) {
        // Turned, tapered timber legs; rear posts join the oval back to the seat.
        parts.push(new THREE.CylinderGeometry(0.026, 0.016, 0.42, 10).translate(x, 0.21, z))
        parts.push(new THREE.SphereGeometry(0.03, 10, 6).translate(x, 0.35, z))
      }
      parts.push(new THREE.BoxGeometry(0.035, 0.28, 0.04).translate(x * 0.9, 0.56, 0.2))
    }
    const merged = mergeGeometries(parts)!
    parts.forEach((part) => part.dispose())
    return merged
  }, [])
  useEffect(() => () => legGeometry.dispose(), [legGeometry])
  useInstances(tops, tableItems)
  useInstances(legs, legItems)
  useInstances(seats, seatItems)
  const paddingItems = useMemo(() => backItems.map((item) => ({ ...item, scale: [0.88, 1.15, 0.12] as [number, number, number] })), [backItems])
  useInstances(backs, paddingItems)
  useInstances(rims, backItems)
  useInstances(chairLegs, chairs)
  const frameItems = useMemo(() => chairs.map((c) => ({ ...c, position: [c.position[0], 0.405, c.position[2]] as [number, number, number] })), [chairs])
  useInstances(seatFrames, frameItems)
  return (
    <group>
      <instancedMesh ref={tops} args={[undefined, undefined, tableItems.length]} castShadow>
        <boxGeometry args={[1.3, 0.04, 0.8]} />
        <meshStandardMaterial color="#ae7948" roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={legs} args={[undefined, undefined, legItems.length]}>
        <boxGeometry args={[0.04, 0.74, 0.04]} />
        <meshStandardMaterial color="#1d1e20" roughness={0.5} metalness={0.4} />
      </instancedMesh>
      <instancedMesh ref={seats} args={[undefined, undefined, seatItems.length]}>
        <boxGeometry args={[0.44, 0.065, 0.42]} />
        <meshStandardMaterial map={upholstery} roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={backs} args={[undefined, undefined, backItems.length]}>
        <sphereGeometry args={[0.205, 24, 16]} />
        <meshStandardMaterial map={upholstery} roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={rims} args={[undefined, undefined, backItems.length]}>
        <torusGeometry args={[0.225, 0.027, 8, 32]} />
        <meshStandardMaterial color="#795333" roughness={0.65} />
      </instancedMesh>
      <instancedMesh ref={chairLegs} args={[legGeometry, undefined, chairs.length]} castShadow>
        <meshStandardMaterial color="#795333" roughness={0.78} />
      </instancedMesh>
      <instancedMesh ref={seatFrames} args={[undefined, undefined, chairs.length]} castShadow>
        <boxGeometry args={[0.47, 0.07, 0.45]} />
        <meshStandardMaterial color="#795333" roughness={0.78} />
      </instancedMesh>
    </group>
  )
}

/** Between the seating and the shop aisle, as seen after turning left from the entrance. */
function CafeBar() {
  const signs = useMemo(() => ({ cafe: fasciaTexture('CAFÉ', []), fair: fasciaTexture('TIENDA', ['LABORATORIO · AL FONDO']) }), [])
  useEffect(() => () => Object.values(signs).forEach((texture) => texture.dispose()), [signs])
  const x = (CAFE_BAR.x0 + CAFE_BAR.x1) / 2
  const z = (CAFE_BAR.z0 + CAFE_BAR.z1) / 2
  const width = CAFE_BAR.x1 - CAFE_BAR.x0
  return <group>
    <mesh position={[x, CAFE_BAR.height, z]} castShadow>
      <boxGeometry args={[width + 0.12, 0.055, 0.97]} />
      <meshStandardMaterial color="#b4a58b" roughness={0.45} />
    </mesh>
    {/* Recessed panels in the black customer-facing counter. */}
    {[-1.85, -0.62, 0.62, 1.85].map((dx) => <mesh key={dx} position={[x + dx, 0.57, CAFE_BAR.z1 + 0.008]}>
      <boxGeometry args={[1.12, 0.78, 0.015]} />
      <meshStandardMaterial color="#242426" roughness={0.42} />
    </mesh>)}
    {/* Espresso machine, drip tray and cups, sized relative to the 108 cm bar. */}
    <group position={[x - 0.9, CAFE_BAR.height + 0.03, z]}>
      <mesh position={[0, 0.22, 0.08]} castShadow>
        <boxGeometry args={[0.72, 0.44, 0.42]} />
        <meshStandardMaterial color="#777c7d" metalness={0.7} roughness={0.26} />
      </mesh>
      <mesh position={[0, 0.04, -0.18]}>
        <boxGeometry args={[0.76, 0.05, 0.22]} />
        <meshStandardMaterial color="#242628" metalness={0.5} roughness={0.3} />
      </mesh>
      {[-0.23, 0, 0.23].map((dx) => <mesh key={dx} position={[dx, 0.48, 0.06]}>
        <cylinderGeometry args={[0.035, 0.025, 0.07, 12]} />
        <meshStandardMaterial color="#eee7da" roughness={0.3} />
      </mesh>)}
    </group>
    <mesh position={[x, 3.35, z]}>
      <boxGeometry args={[width + 0.1, 0.9, 0.95]} />
      <meshStandardMaterial color="#141416" roughness={0.65} />
    </mesh>
    <Decal texture={signs.cafe} position={[x, 3.35, z + 0.477]} size={[2.8, 0.8]} />
    {/* Wayfinding above the clear aisle, readable when entering from the hall. */}
    <Decal texture={signs.fair} position={[-24, 2.8, -1.65]} size={[1.6, 0.46]} rotationY={Math.PI / 2} />
  </group>
}

function Decal({ texture, position, size, rotationY = 0 }: { texture: THREE.Texture; position: [number, number, number]; size: [number, number]; rotationY?: number }) {
  return (
    <mesh position={position} rotation={[0, rotationY, 0]}>
      <planeGeometry args={size} />
      <meshStandardMaterial map={texture} transparent roughness={0.4} polygonOffset polygonOffsetFactor={-1} />
    </mesh>
  )
}

/** Tienda FINDE: lettered fascia, a board-formed backdrop, shelves and goods on the counters. */
function Shop() {
  const textures = useMemo(() => ({
    north: fasciaTexture('TIENDA finde', ['MAR  Museo de Arte Contemporáneo Buenos Aires', 'INSTITUTO CULTURAL  ·  GOBIERNO DE LA PROVINCIA DE BUENOS AIRES']),
    west: cafeEmblemTexture(),
    board: boardTexture(),
  }), [])
  useEffect(() => () => Object.values(textures).forEach((texture) => texture.dispose()), [textures])
  const goods = useRef<THREE.InstancedMesh>(null)
  const items = useMemo(() => {
    const random = seeded(5)
    return Array.from({ length: 40 }, (_, index) => {
      const onNorth = index % 2 === 0
      return {
        position: (onNorth
          ? [SHOP.x0 + 0.4 + random() * (SHOP.x1 - SHOP.x0 - 0.8), 1.2, SHOP.z1 - 0.55]
          : [SHOP.x1 - 0.35, 1.2, SHOP.z0 + 0.6 + random() * (SHOP.z1 - SHOP.z0 - 1.2)]) as [number, number, number],
        rotation: random() * 3,
        scale: [0.6 + random() * 0.9, 0.5 + random() * 1.4, 0.6 + random() * 0.9] as [number, number, number],
      }
    })
  }, [])
  useInstances(goods, items)
  const colors = useMemo(() => ['#e8d34a', '#d85a3f', '#3c8fc9', '#f1ece2', '#5aa06a'].map((c) => new THREE.Color(c)), [])
  useLayoutEffect(() => {
    const mesh = goods.current
    if (!mesh) return
    colors.forEach((_, index) => index)
    items.forEach((_, index) => mesh.setColorAt(index, colors[index % colors.length]))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [colors, items])
  const backdropMap = useMemo(() => {
    const map = textures.board
    map.repeat.set(4.4 / 2.4, 3.4 / 2.4)
    return map
  }, [textures.board])
  return (
    <group>
      <Decal texture={textures.north} position={[(SHOP.x0 - 0.2 + SHOP.x1 + 0.1) / 2, 3.65, SHOP.z1 + 0.002]} size={[SHOP.x1 - SHOP.x0 + 0.3, 1.3]} />
      <Decal texture={textures.west} position={[SHOP.x1 + 0.102, 3.65, (SHOP.z0 + SHOP.z1) / 2]} size={[1.16, 1.16]} rotationY={Math.PI / 2} />
      {/* Backdrop's printed face, on the side the staff and the shelves see. */}
      <mesh position={[(SHOP.x0 + SHOP.x1) / 2, 1.7, SHOP.z0 + 0.205]}>
        <planeGeometry args={[SHOP.x1 - SHOP.x0, 3.4]} />
        <meshStandardMaterial map={backdropMap} roughness={0.95} />
      </mesh>
      {/* White shelves on the backdrop. */}
      {[1.6, 2.2].map((y) => (
        <mesh key={y} position={[(SHOP.x0 + SHOP.x1) / 2, y, SHOP.z0 + 0.45]}>
          <boxGeometry args={[SHOP.x1 - SHOP.x0 - 0.5, 0.03, 0.3]} />
          <meshStandardMaterial color="#f2f1ee" roughness={0.6} />
        </mesh>
      ))}
      <instancedMesh ref={goods} args={[undefined, undefined, items.length]}>
        <boxGeometry args={[0.2, 0.2, 0.2]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
    </group>
  )
}

/** The Laboratorio: its lettering on both faces of the black wall. */
function Laboratorio() {
  const text = useMemo(() => labTexture(), [])
  useEffect(() => () => text.dispose(), [text])
  const x = -25
  const half = MAR.partition * 0.67
  return (
    <>
      <Decal texture={text} position={[x + half, 3.5, -10.75]} size={[2, 0.8]} rotationY={Math.PI / 2} />
      <Decal texture={text} position={[x - half, 3.5, -10.75]} size={[2, 0.8]} rotationY={-Math.PI / 2} />
    </>
  )
}

/** The children's corner at the glass: a carpet, a pale blue bench and a few surfboards leaning on the glazing. */
function LaIsla() {
  const boards = useMemo(() => [
    { x: -29.5, h: 2.0, color: '#d8b58a' },
    { x: -29.0, h: 2.1, color: '#9fb2c2' },
    { x: -28.5, h: 2.0, color: '#d8b58a' },
    { x: -28.0, h: 2.15, color: '#6b86a3' },
  ], [])
  return (
    <group>
      <mesh position={[-28.3, 0.025, 6.55]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.2, 2.4]} />
        <meshStandardMaterial color="#b6a58f" roughness={1} />
      </mesh>
      <mesh position={[-28.3, 0.16, 5.9]}>
        <boxGeometry args={[2.2, 0.32, 0.4]} />
        <meshStandardMaterial color="#9dbbd8" roughness={0.8} />
      </mesh>
      {boards.map((board) => (
        <mesh key={board.x} position={[board.x, board.h / 2 + 0.05, 7.65]} rotation={[-0.08, 0, 0]}>
          <boxGeometry args={[0.38, board.h, 0.05]} />
          <meshStandardMaterial color={board.color} roughness={0.55} />
        </mesh>
      ))}
    </group>
  )
}

/** Small things on the walls and floor that give the hall its look: a fire hose cabinet, a marble table, the floor drain. */
function HallProps() {
  const grate = useMemo(() => {
    const map = grateTexture()
    map.repeat.set(26 / 0.9, 1)
    return map
  }, [])
  useEffect(() => () => grate.dispose(), [grate])
  return (
    <group>
      {/* Marble-topped table on gold legs. */}
      <mesh position={[-10.9, 0.78, -1.7]}>
        <boxGeometry args={[0.8, 0.04, 2.4]} />
        <meshStandardMaterial color="#ece8e1" roughness={0.3} />
      </mesh>
      {[[-1.1, -0.34], [1.1, -0.34], [-1.1, 0.34], [1.1, 0.34]].map(([dx, dz]) => (
        <mesh key={`${dx}${dz}`} position={[-10.9 + dz, 0.38, -1.7 + dx]}>
          <boxGeometry args={[0.04, 0.76, 0.04]} />
          <meshStandardMaterial color="#c8a05a" roughness={0.35} metalness={0.4} />
        </mesh>
      ))}
      {/* Floor drain along the foot of the north wall. */}
      <mesh position={[1, 0.03, -19.55]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[25.6, 0.3]} />
        <meshStandardMaterial map={grate} roughness={0.6} />
      </mesh>
    </group>
  )
}

/** A white track and spot fixtures along the west room's north wall, as in the wall photograph. */
function Track() {
  const spots = useRef<THREE.InstancedMesh>(null)
  const items = useMemo(() => Array.from({ length: 7 }, (_, i) => ({ position: [-28 + i * 2.5, 4.62, -11.35] as [number, number, number] })), [])
  useInstances(spots, items)
  return (
    <group>
      <mesh position={[-21, 4.78, -11.55]}>
        <boxGeometry args={[17, 0.07, 0.1]} />
        <meshStandardMaterial color="#e8e8e6" roughness={0.5} />
      </mesh>
      <instancedMesh ref={spots} args={[undefined, undefined, items.length]}>
        <boxGeometry args={[0.14, 0.14, 0.2]} />
        <meshStandardMaterial color="#1b1c1e" roughness={0.5} />
      </instancedMesh>
    </group>
  )
}


/**
 * The 30 × 30 m upper gallery: a bright strip in the roof down every aisle
 * between partitions, track lights over each partition and along the long
 * walls, and a few point lights so the room reads bright without a window.
 */
function GalleryRoom({ materials }: { materials: InteriorMaterials }) {
  const light = useMemo(() => new THREE.MeshBasicMaterial({ color: '#e8f1fa', toneMapped: false }), [])
  useEffect(() => () => light.dispose(), [light])
  const spots = useRef<THREE.InstancedMesh>(null)
  const top = GALLERY.top
  const { xs, z0, z1 } = GALLERY.partitions
  // Aisle centres: between the west wall, each partition and the east wall.
  const aisles = useMemo(() => {
    const edges = [GALLERY.x0, ...xs, GALLERY.x1]
    return edges.slice(1).map((edge, index) => (edges[index] + edge) / 2)
  }, [xs])
  const items = useMemo(() => {
    const out: Array<{ position: [number, number, number] }> = []
    const y = top - 0.25
    for (const x of xs) for (let k = 0; k < 8; k++) out.push({ position: [x, y, z0 + 1.2 + k * 3] })
    for (let k = 0; k < 16; k++) out.push({ position: [GALLERY.x0 + 1.2 + k * 1.9, y, GALLERY.z0 + 0.4] })
    for (let k = 0; k < 16; k++) out.push({ position: [GALLERY.x0 + 1.2 + k * 1.9, y, GALLERY.z1 - 0.4] })
    return out
  }, [xs, top, z0])
  useInstances(spots, items)
  const cz = (GALLERY.z0 + GALLERY.z1) / 2
  return (
    <group>
      {aisles.map((x) => (
        <mesh key={x} position={[x, top - 0.02, (z0 + z1) / 2]} rotation={[Math.PI / 2, 0, 0]} material={light}>
          <planeGeometry args={[1.6, z1 - z0]} />
        </mesh>
      ))}
      {/* Rails the spots hang from, one over each partition. */}
      {xs.map((x) => (
        <mesh key={x} position={[x, top - 0.12, (z0 + z1) / 2]} material={materials.lamp}>
          <boxGeometry args={[0.06, 0.05, z1 - z0]} />
        </mesh>
      ))}
      <instancedMesh ref={spots} args={[undefined, undefined, items.length]}>
        <boxGeometry args={[0.14, 0.16, 0.2]} />
        <meshStandardMaterial color="#f1f1ef" roughness={0.5} />
      </instancedMesh>
      {[-35, -27, -19].map((x) => (
        <pointLight key={x} position={[x, top - 1, cz]} intensity={34} distance={22} decay={2} color="#fff6ea" />
      ))}
    </group>
  )
}

/** Thin steel caps and panel joints on the continuous upper glass balustrade. */
function UpperBalustrades({ materials }: { materials: InteriorMaterials }) {
  const rails = marBoxes.filter((box) => box.kind === 'glass' && box.minY === MAR.mezzanine)
  return <group>
    {rails.map((rail) => {
      const alongX = rail.maxX - rail.minX > rail.maxZ - rail.minZ
      const length = alongX ? rail.maxX - rail.minX : rail.maxZ - rail.minZ
      const count = Math.max(1, Math.ceil(length / 1.5))
      return <group key={rail.id} position={[(rail.minX + rail.maxX) / 2, MAR.mezzanine, (rail.minZ + rail.maxZ) / 2]} rotation={[0, alongX ? 0 : Math.PI / 2, 0]}>
        <mesh position={[0, 1.1, 0]} material={materials.steel}><boxGeometry args={[length, 0.045, 0.055]} /></mesh>
        <mesh position={[0, 0.025, 0]} material={materials.steel}><boxGeometry args={[length, 0.05, 0.065]} /></mesh>
        {Array.from({ length: count - 1 }, (_, i) => <mesh key={i} position={[-length / 2 + (i + 1) * length / count, 0.55, 0]} material={materials.steel}>
          <boxGeometry args={[0.009, 1.05, 0.02]} />
        </mesh>)}
      </group>
    })}
  </group>
}

export function Interior({ materials }: { materials: InteriorMaterials }) {
  return (
    <group>
      <HallRoof materials={materials} />
      <WestCeiling materials={materials} />
      <Cafe />
      <CafeBar />
      <Shop />
      <Laboratorio />
      <LaIsla />
      <HallProps />
      <EntranceDetails />
      <Track />
      <GalleryRoom materials={materials} />
      <UpperBalustrades materials={materials} />
      <UpperHall materials={materials} />
    </group>
  )
}

