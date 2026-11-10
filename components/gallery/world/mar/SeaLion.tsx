'use client'

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { LOBO } from './layout'
import { WEAVE_TILE, seeded, weaveTexture } from './textures'

// The woven sea lion on the plaza: a temporary installation, kept as a model
// because it dominates every photograph of the front. Proportions are read off
// those photographs (about nine metres to the muzzle, eleven long); nothing
// here is surveyed.

type Section = { x: number; y: number; /** Radius in the plane of the spine. */ ry: number; /** Radius across it. */ rz: number }

/** From the muzzle, down the raised neck and chest, then along the lying body to the tail. */
const SPINE: Section[] = [
  { x: -0.55, y: 9.75, ry: 0.04, rz: 0.04 },
  { x: -0.6, y: 9.55, ry: 0.42, rz: 0.4 },
  { x: -0.45, y: 9.1, ry: 0.9, rz: 0.84 },
  { x: -0.3, y: 8.3, ry: 1.35, rz: 1.22 },
  { x: -0.1, y: 7.1, ry: 1.7, rz: 1.5 },
  { x: 0.15, y: 5.9, ry: 2.05, rz: 1.8 },
  { x: 0.55, y: 4.6, ry: 2.15, rz: 1.9 },
  { x: 1.5, y: 3.35, ry: 2.5, rz: 2.15 },
  { x: 3.4, y: 2.65, ry: 2.5, rz: 2.1 },
  { x: 5.9, y: 2.25, ry: 2.25, rz: 1.85 },
  { x: 8.4, y: 1.75, ry: 1.65, rz: 1.35 },
  { x: 10.1, y: 1.3, ry: 0.85, rz: 0.75 },
  { x: 10.9, y: 1.0, ry: 0.05, rz: 0.05 },
]

/**
 * A tube along SPINE whose cross-section is an ellipse that grows and shrinks.
 * The spine lies in the XY plane, so the second axis is always Z.
 */
export function sweptBodyGeometry(spine: Section[] = SPINE, around = 36, along = 90) {
  const curve = new THREE.CatmullRomCurve3(spine.map((s) => new THREE.Vector3(s.x, s.y, 0)), false, 'centripetal')
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  // Sample by curve parameter, not arc length, so t lines up with the spine's own sections.
  let travelled = 0
  let previous = curve.getPoint(0)
  for (let i = 0; i <= along; i++) {
    const t = i / along
    const point = curve.getPoint(t)
    travelled += point.distanceTo(previous)
    previous = point
    const tangent = curve.getTangent(t)
    const normal = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize()
    // Radii: interpolate between the spine's own sections by arc position along the control polygon.
    const scaled = t * (spine.length - 1)
    const a = Math.min(spine.length - 2, Math.floor(scaled))
    const f = scaled - a
    const smooth = f * f * (3 - 2 * f)
    const ry = spine[a].ry + (spine[a + 1].ry - spine[a].ry) * smooth
    const rz = spine[a].rz + (spine[a + 1].rz - spine[a].rz) * smooth
    for (let j = 0; j <= around; j++) {
      const angle = (j / around) * Math.PI * 2
      positions.push(point.x + normal.x * ry * Math.cos(angle), point.y + normal.y * ry * Math.cos(angle), rz * Math.sin(angle))
      // Four repeats round a body about 10 m in girth keeps one weave tile near 2.4 m.
      uvs.push((j / around) * 4, travelled / WEAVE_TILE)
    }
  }
  for (let i = 0; i < along; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * (around + 1) + j
      const b = a + around + 1
      indices.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/**
 * A unit sphere whose UVs are scaled so the weave keeps its true size once the
 * mesh is stretched to radii (metres), instead of one tile across the whole flipper.
 */
function flipperGeometry(radii: [number, number, number], widthSegments = 18, heightSegments = 12) {
  const geometry = new THREE.SphereGeometry(1, widthSegments, heightSegments)
  const uv = geometry.getAttribute('uv')
  const around = (2 * Math.PI * (radii[0] + radii[2])) / 2 / WEAVE_TILE
  const down = (Math.PI * radii[1]) / WEAVE_TILE
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * around, uv.getY(i) * down)
  uv.needsUpdate = true
  return geometry
}

/** Seeded scatter of rocks on the slab, thicker around the sculpture's feet. */
function rockPlacements() {
  const random = seeded(91)
  const rocks: Array<{ position: [number, number, number]; scale: [number, number, number]; rotation: [number, number, number] }> = []
  for (let i = 0; i < 70; i++) {
    const x = LOBO.head.x - 1.2 + random() * 9.5
    const z = LOBO.head.z + (random() - 0.5) * 4.6
    const size = 0.12 + random() * random() * 0.36
    rocks.push({
      position: [x, LOBO.height + size * 0.3, z],
      scale: [size * (0.8 + random() * 0.7), size * (0.6 + random() * 0.4), size * (0.8 + random() * 0.6)],
      rotation: [random() * 3, random() * 3, random() * 3],
    })
  }
  return rocks
}

function Rocks() {
  const rocks = useMemo(() => rockPlacements(), [])
  const geometry = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1, 0)
    return g
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <>
      {rocks.map((rock, index) => (
        <mesh key={index} geometry={geometry} position={rock.position} scale={rock.scale} rotation={rock.rotation} castShadow receiveShadow>
          <meshStandardMaterial color={index % 4 === 0 ? '#d9d5cb' : index % 3 === 0 ? '#9a978f' : '#bdb9ae'} roughness={0.95} flatShading />
        </mesh>
      ))}
    </>
  )
}

/** Steel pipe rail round the slab, held out on angled flat brackets every two metres or so. */
function Rail() {
  const { x0, x1, z0, z1, height } = LOBO
  const inset = 0.15
  const top = height + 1.0
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: '#cfd3d6', roughness: 0.4, metalness: 0.3 }), [])
  useEffect(() => () => steel.dispose(), [steel])
  const sides: Array<{ from: [number, number]; to: [number, number]; normal: [number, number] }> = [
    { from: [x0 + inset, z1 - inset], to: [x1 - inset, z1 - inset], normal: [0, 1] },
    { from: [x0 + inset, z0 + inset], to: [x1 - inset, z0 + inset], normal: [0, -1] },
    { from: [x0 + inset, z0 + inset], to: [x0 + inset, z1 - inset], normal: [-1, 0] },
    { from: [x1 - inset, z0 + inset], to: [x1 - inset, z1 - inset], normal: [1, 0] },
  ]
  return (
    <>
      {sides.map((side, index) => {
        const dx = side.to[0] - side.from[0]
        const dz = side.to[1] - side.from[1]
        const length = Math.hypot(dx, dz)
        const yaw = Math.atan2(dx, dz)
        const posts = Math.max(2, Math.round(length / 2.2) + 1)
        return (
          <group key={index}>
            <mesh position={[(side.from[0] + side.to[0]) / 2, top, (side.from[1] + side.to[1]) / 2]} rotation={[Math.PI / 2, 0, -yaw]} material={steel}>
              <cylinderGeometry args={[0.025, 0.025, length, 8]} />
            </mesh>
            {Array.from({ length: posts }, (_, k) => {
              const f = posts === 1 ? 0 : k / (posts - 1)
              const x = side.from[0] + dx * f
              const z = side.from[1] + dz * f
              // The bracket slopes from the rail down and outward to the slab's edge.
              return (
                <mesh
                  key={k}
                  position={[x + side.normal[0] * 0.28, height + 0.5, z + side.normal[1] * 0.28]}
                  rotation={[side.normal[1] * -0.5, 0, side.normal[0] * 0.5]}
                  material={steel}
                >
                  <boxGeometry args={[side.normal[0] ? 0.03 : 0.04, 1.05, side.normal[1] ? 0.03 : 0.04]} />
                </mesh>
              )
            })}
          </group>
        )
      })}
    </>
  )
}

export function SeaLion() {
  const resources = useMemo(() => {
    const map = weaveTexture()
    const body = sweptBodyGeometry()
    const material = new THREE.MeshStandardMaterial({ map, color: '#fff6d8', roughness: 0.6, metalness: 0.05, emissive: '#5a4518', emissiveIntensity: 0.14 })
    const slab = new THREE.MeshStandardMaterial({ color: '#cdbfa6', roughness: 0.85 })
    const gravel = new THREE.MeshStandardMaterial({ color: '#d8d4c8', roughness: 1 })
    const flippers = {
      hanging: flipperGeometry([0.85, 2.35, 0.5]),
      foot: flipperGeometry([1.5, 0.36, 0.85]),
      hind: flipperGeometry([1.5, 0.35, 0.75]),
    }
    return { map, body, material, slab, gravel, flippers }
  }, [])
  useEffect(() => () => {
    resources.map.dispose()
    resources.body.dispose()
    resources.material.dispose()
    resources.slab.dispose()
    resources.gravel.dispose()
    Object.values(resources.flippers).forEach((geometry) => geometry.dispose())
  }, [resources])

  const { x0, x1, z0, z1, height, head } = LOBO
  const flipperMap = resources.material
  return (
    <group>
      {/* The slab and its bed of white gravel. */}
      <mesh position={[(x0 + x1) / 2, height / 2, (z0 + z1) / 2]} material={resources.slab} castShadow receiveShadow>
        <boxGeometry args={[x1 - x0, height, z1 - z0]} />
      </mesh>
      <mesh position={[(x0 + x1) / 2, height + 0.015, (z0 + z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} material={resources.gravel}>
        <planeGeometry args={[x1 - x0 - 0.7, z1 - z0 - 0.7]} />
      </mesh>
      <Rocks />
      <Rail />

      <group position={[head.x, height, head.z]}>
        <mesh geometry={resources.body} material={resources.material} castShadow receiveShadow />
        {/* Front flippers hang from the chest like flat panels, their tips on the ground. */}
        {[1, -1].map((side) => (
          <group key={`f${side}`}>
            <mesh position={[1.1, 2.05, side * 1.95]} rotation={[side * 0.1, 0, 0]} scale={[0.85, 2.35, 0.5]} geometry={resources.flippers.hanging} material={flipperMap} castShadow receiveShadow />
            <mesh position={[0.5, 0.35, side * 2.1]} rotation={[0, side * -0.6, 0]} scale={[1.5, 0.36, 0.85]} geometry={resources.flippers.foot} material={flipperMap} castShadow receiveShadow />
          </group>
        ))}
        {/* Hind flippers at the tail. */}
        {[1, -1].map((side) => (
          <mesh key={`h${side}`} position={[10.6, 0.4, side * 1.05]} rotation={[0, side * 0.3, 0]} scale={[1.5, 0.35, 0.75]} geometry={resources.flippers.hind} material={flipperMap} castShadow receiveShadow />
        ))}
      </group>
    </group>
  )
}
