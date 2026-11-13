'use client'

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useLoader } from '@react-three/fiber'
import { LOBO } from './layout'
import { loboPlaqueTexture } from './decals'
import { seeded } from './textures'
import { seaLionBodyGeometry, seaLionForeflipperGeometry, seaLionHindflipperGeometry, seaLionFaceGeometries } from './seaLionGeometry'
import { seaLionGoldMaterial } from './seaLionMaterial'

/** Pale angular stones cover the plinth, as in the plaza photographs. */
function rockPlacements() {
  const random = seeded(91)
  return Array.from({ length: 760 }, () => {
    const x = LOBO.x0 + 0.35 + random() * (LOBO.x1 - LOBO.x0 - 0.7)
    const z = LOBO.z0 + 0.35 + random() * (LOBO.z1 - LOBO.z0 - 0.7)
    const size = 0.11 + random() * random() * 0.3
    return {
      position: [x, LOBO.height + size * 0.38, z] as const,
      scale: [size * (0.85 + random() * 0.65), size * (0.65 + random() * 0.45), size * (0.8 + random() * 0.6)] as const,
      rotation: [random() * 3, random() * 3, random() * 3] as const,
      color: new THREE.Color().setHSL(0.12, 0.025 + random() * 0.065, 0.52 + random() * 0.24),
    }
  })
}

function Rocks() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const rocks = useMemo(() => rockPlacements(), [])
  const geometry = useMemo(() => {
    const g = new THREE.DodecahedronGeometry(1, 0)
    const position = g.getAttribute('position')
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i)
      const y = position.getY(i)
      const z = position.getZ(i)
      const uneven = 1 + 0.15 * Math.sin(x * 9 + z * 5) * Math.cos(y * 7)
      position.setXYZ(i, x * uneven, y * uneven, z * uneven)
    }
    g.computeVertexNormals()
    return g
  }, [])
  useLayoutEffect(() => {
    if (!mesh.current) return
    const transform = new THREE.Object3D()
    rocks.forEach((rock, index) => {
      transform.position.set(...rock.position)
      transform.rotation.set(...rock.rotation)
      transform.scale.set(...rock.scale)
      transform.updateMatrix()
      mesh.current!.setMatrixAt(index, transform.matrix)
      mesh.current!.setColorAt(index, rock.color)
    })
    mesh.current.instanceMatrix.needsUpdate = true
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
    mesh.current.computeBoundingSphere()
  }, [rocks])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, rocks.length]} castShadow receiveShadow>
      <meshStandardMaterial roughness={0.96} flatShading />
    </instancedMesh>
  )
}

/** Steel pipe rail round the slab, held out on angled flat brackets every two metres or so. */
function Rail() {
  const { x0, x1, z0, z1, height } = LOBO
  const inset = 0.15
  const top = height + 0.68
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
                  position={[x + side.normal[0] * 0.2, height + 0.32, z + side.normal[1] * 0.2]}
                  rotation={[side.normal[1] * -0.5, 0, side.normal[0] * 0.5]}
                  material={steel}
                >
                  <boxGeometry args={[side.normal[0] ? 0.03 : 0.09, 0.76, side.normal[1] ? 0.03 : 0.04]} />
                </mesh>
              )
            })}
          </group>
        )
      })}
    </>
  )
}

/** The plaque at the sea lion's foot, tilted back on two posts, facing the plaza. */
function Plaque({ texture }: { texture: THREE.Texture }) {
  const { z1, height, head } = LOBO
  const x = head.x + 2.4
  const z = z1 - 1.5
  return (
    <group position={[x, height, z]}>
      {[-0.42, 0.42].map((dx) => (
        <mesh key={dx} position={[dx, 0.2, -0.05]} castShadow>
          <boxGeometry args={[0.04, 0.4, 0.04]} />
          <meshStandardMaterial color="#2a2c2e" roughness={0.6} metalness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 0.5, 0]} rotation={[-0.5, 0, 0]}>
        <boxGeometry args={[1.0, 0.43, 0.03]} />
        <meshStandardMaterial color="#b8bbbd" roughness={0.45} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.5, 0.017]} rotation={[-0.5, 0, 0]}>
        <planeGeometry args={[0.96, 0.4]} />
        <meshStandardMaterial map={texture} roughness={0.5} metalness={0.15} />
      </mesh>
    </group>
  )
}

export function SeaLion() {
  const wrappers = useLoader(THREE.TextureLoader, '/mar/sea-lion-wrappers-v1.webp')
  const resources = useMemo(() => {
    const { material, textures } = seaLionGoldMaterial(wrappers)
    const plaque = loboPlaqueTexture()
    const body = seaLionBodyGeometry()
    const slab = new THREE.MeshStandardMaterial({ color: '#bdb8a9', roughness: 0.95 })
    const gravel = new THREE.MeshStandardMaterial({ color: '#c9c7b9', roughness: 1 })
    const details = [1, -1].flatMap((side) => [
      seaLionForeflipperGeometry(side as 1 | -1),
      seaLionHindflipperGeometry(side as 1 | -1),
    ])
    const face = seaLionFaceGeometries()
    const recess = material.clone()
    recess.onBeforeCompile = material.onBeforeCompile
    recess.customProgramCacheKey = material.customProgramCacheKey
    recess.color.set('#8f7136')
    recess.roughness = 0.85
    recess.envMapIntensity = 0.45
    return { textures, plaque, body, material, slab, gravel, details: [...details, ...face.gold], recesses: face.recesses, recess }
  }, [wrappers])
  useEffect(() => () => {
    resources.textures.forEach((texture) => texture.dispose())
    resources.plaque.dispose()
    resources.body.dispose()
    resources.material.dispose()
    resources.recess.dispose()
    resources.recesses.forEach((geometry) => geometry.dispose())
    resources.slab.dispose()
    resources.gravel.dispose()
    resources.details.forEach((geometry) => geometry.dispose())
  }, [resources])

  const { x0, x1, z0, z1, height, head } = LOBO
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
      <Plaque texture={resources.plaque} />
      <Rail />

      <group position={[head.x, height, head.z]}>
        <mesh geometry={resources.body} material={resources.material} castShadow receiveShadow />
        {resources.recesses.map((geometry, index) => (
          <mesh key={`recess-${index}`} geometry={geometry} material={resources.recess} castShadow receiveShadow />
        ))}
        {resources.details.map((geometry, index) => (
          <mesh key={index} geometry={geometry} material={resources.material} castShadow receiveShadow />
        ))}
      </group>
    </group>
  )
}
