'use client'

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CAFE_TABLES, GALLERY, MAR, SHOP } from './layout'
import {
  boardTexture,
  fasciaTexture,
  grateTexture,
  labTexture,
  meshCeilingTexture,
  slatTexture,
  vitrineTexture,
} from './interiorDecals'
import { seeded } from './textures'
import { cafeEmblemTexture } from './decals'
import { EntranceDetails } from './EntranceDetails'

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

/** Deep concrete beams across the hall, the skylight between them glowing above. */
function HallRoof({ materials }: { materials: InteriorMaterials }) {
  const skylight = useMemo(() => new THREE.MeshBasicMaterial({ color: '#dfeaf6', toneMapped: false }), [])
  useEffect(() => () => skylight.dispose(), [skylight])
  const beams = useMemo(() => Array.from({ length: 8 }, (_, i) => -10.4 + i * 3.4), [])
  return (
    <group>
      <mesh position={[(HALL.x0 + HALL.x1) / 2, MAR.hallHeight + 0.05, (HALL.z0 + HALL.z1) / 2]} rotation={[Math.PI / 2, 0, 0]} material={skylight}>
        <planeGeometry args={[HALL.x1 - HALL.x0, HALL.z1 - HALL.z0]} />
      </mesh>
      {beams.map((x) => (
        <mesh key={x} position={[x, MAR.hallHeight - 0.75, -9.9]} material={materials.beam} castShadow receiveShadow>
          <boxGeometry args={[0.55, 1.5, 19.7]} />
        </mesh>
      ))}
      {/* Two long cross beams, and the warm light tube down the east column. */}
      {[-14, -5].map((z) => (
        <mesh key={z} position={[1, MAR.hallHeight - 0.3, z]} material={materials.beam}>
          <boxGeometry args={[25.8, 0.6, 0.5]} />
        </mesh>
      ))}
      <mesh position={[HALL.x1 - 0.2, 4.4, -3]} material={materials.lamp}>
        <boxGeometry args={[0.06, 8, 0.06]} />
      </mesh>
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
    return { map, material: new THREE.MeshStandardMaterial({ map, roughness: 0.7, metalness: 0.2 }) }
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
      {[-8, -3, 2, 6].map((z) => (
        <mesh key={z} position={[-21, MAR.westInterior - 0.06, z]} material={materials.lamp}>
          <boxGeometry args={[9, 0.04, 0.12]} />
        </mesh>
      ))}
      <Chandelier position={[-24.4, 4.35, 5]} seed={3} />
      <Chandelier position={[-18, 4.35, 0.5]} seed={9} />
    </group>
  )
}

/** Tables and wire chairs in the café, one set of instanced meshes for all of them. */
function Cafe() {
  const tops = useRef<THREE.InstancedMesh>(null)
  const legs = useRef<THREE.InstancedMesh>(null)
  const seats = useRef<THREE.InstancedMesh>(null)
  const backs = useRef<THREE.InstancedMesh>(null)
  const chairLegs = useRef<THREE.InstancedMesh>(null)
  const tableItems = useMemo(() => CAFE_TABLES.map(([x, z]) => ({ position: [x, 0.74, z] as [number, number, number] })), [])
  const legItems = useMemo(() => CAFE_TABLES.flatMap(([x, z]) => [[-0.55, -0.32], [0.55, -0.32], [-0.55, 0.32], [0.55, 0.32]].map(([dx, dz]) => ({ position: [x + dx, 0.37, z + dz] as [number, number, number] }))), [])
  const chairs = useMemo(() => CAFE_TABLES.flatMap(([x, z]) => [
    { position: [x - 0.35, 0, z + 0.62] as [number, number, number], rotation: 0 },
    { position: [x + 0.35, 0, z + 0.62] as [number, number, number], rotation: 0 },
    { position: [x - 0.35, 0, z - 0.62] as [number, number, number], rotation: Math.PI },
    { position: [x + 0.35, 0, z - 0.62] as [number, number, number], rotation: Math.PI },
  ]), [])
  const seatItems = useMemo(() => chairs.map((c) => ({ ...c, position: [c.position[0], 0.46, c.position[2]] as [number, number, number] })), [chairs])
  const backItems = useMemo(() => chairs.map((c) => ({ ...c, position: [c.position[0], 0.72, c.position[2] + (c.rotation === 0 ? 0.2 : -0.2)] as [number, number, number] })), [chairs])
  const legGeometry = useMemo(() => {
    const parts = [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]].map(([x, z]) => new THREE.BoxGeometry(0.025, 0.46, 0.025).translate(x, 0.23, z))
    const merged = mergeGeometries(parts)!
    parts.forEach((part) => part.dispose())
    return merged
  }, [])
  useEffect(() => () => legGeometry.dispose(), [legGeometry])
  useInstances(tops, tableItems)
  useInstances(legs, legItems)
  useInstances(seats, seatItems)
  useInstances(backs, backItems)
  useInstances(chairLegs, chairs)
  return (
    <group>
      <instancedMesh ref={tops} args={[undefined, undefined, tableItems.length]} castShadow>
        <boxGeometry args={[1.3, 0.04, 0.8]} />
        <meshStandardMaterial color="#8a6a48" roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={legs} args={[undefined, undefined, legItems.length]}>
        <boxGeometry args={[0.04, 0.74, 0.04]} />
        <meshStandardMaterial color="#1d1e20" roughness={0.5} metalness={0.4} />
      </instancedMesh>
      <instancedMesh ref={seats} args={[undefined, undefined, seatItems.length]}>
        <boxGeometry args={[0.42, 0.05, 0.42]} />
        <meshStandardMaterial color="#2f3a2b" roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={backs} args={[undefined, undefined, backItems.length]}>
        <boxGeometry args={[0.42, 0.4, 0.03]} />
        <meshStandardMaterial color="#1b1c1e" roughness={0.5} metalness={0.4} />
      </instancedMesh>
      <instancedMesh ref={chairLegs} args={[legGeometry, undefined, chairs.length]}>
        <meshStandardMaterial color="#1b1c1e" roughness={0.5} metalness={0.4} />
      </instancedMesh>
    </group>
  )
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

const U = MAR.mezzanine

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

/** A white display case on four legs, its grey fascia lettered. Metres: 2.2 × 1.0, top at 0.95. */
function Vitrine({ position, texture }: { position: [number, number, number]; texture: THREE.Texture }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.65, 0]}>
        <boxGeometry args={[2.2, 0.55, 0.95]} />
        <meshStandardMaterial color="#f3f2ef" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.65, 0.4755]}>
        <planeGeometry args={[2.1, 0.45]} />
        <meshStandardMaterial map={texture} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.94, 0]}>
        <boxGeometry args={[2.0, 0.03, 0.78]} />
        <meshStandardMaterial color="#bcd2dc" transparent opacity={0.35} roughness={0.1} />
      </mesh>
      {[[-1, -0.4], [1, -0.4], [-1, 0.4], [1, 0.4]].map(([dx, dz]) => (
        <mesh key={`${dx}${dz}`} position={[dx, 0.19, dz]}>
          <boxGeometry args={[0.08, 0.38, 0.08]} />
          <meshStandardMaterial color="#f3f2ef" roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

/** A white leather lounge chair on a chrome frame, yaw about the vertical. */
function LoungeChair({ position, yaw }: { position: [number, number, number]; yaw: number }) {
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[0.78, 0.2, 0.7]} />
        <meshStandardMaterial color="#efece6" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.66, -0.3]} rotation={[-0.15, 0, 0]}>
        <boxGeometry args={[0.78, 0.5, 0.14]} />
        <meshStandardMaterial color="#efece6" roughness={0.5} />
      </mesh>
      {[[-0.34, -0.28], [0.34, -0.28], [-0.34, 0.28], [0.34, 0.28]].map(([dx, dz]) => (
        <mesh key={`${dx}${dz}`} position={[dx, 0.15, dz]}>
          <boxGeometry args={[0.03, 0.3, 0.03]} />
          <meshStandardMaterial color="#cfd3d6" roughness={0.3} metalness={0.4} />
        </mesh>
      ))}
    </group>
  )
}

/** The lounge on the landing: two lettered display cases and two chairs, as in the upper-floor photographs. */
function Lounge() {
  const texture = useMemo(() => vitrineTexture(), [])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <group>
      <Vitrine position={[9.3, U, -16.1]} texture={texture} />
      <Vitrine position={[12.6, U, -12.85]} texture={texture} />
      <LoungeChair position={[12.05, U, -10.45]} yaw={0.5} />
      <LoungeChair position={[13.2, U, -10.65]} yaw={-0.35} />
    </group>
  )
}

export function Interior({ materials }: { materials: InteriorMaterials }) {
  return (
    <group>
      <HallRoof materials={materials} />
      <WestCeiling materials={materials} />
      <Cafe />
      <Shop />
      <Laboratorio />
      <LaIsla />
      <HallProps />
      <EntranceDetails />
      <Track />
      <GalleryRoom materials={materials} />
      <Lounge />
    </group>
  )
}

