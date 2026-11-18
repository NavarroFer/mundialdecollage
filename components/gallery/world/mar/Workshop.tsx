'use client'

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { MAR, SHOP, WORKSHOP } from './layout'
import { meshCeilingTexture } from './interiorDecals'

const white = '#e4e4df'
const steel = '#28292a'

function Shelf({ x, z, depth = 2.5 }: { x: number; z: number; depth?: number }) {
  return (
    <group position={[x, 0, z]}>
      {[-0.21, 0.21].flatMap((dx) => [-depth / 2, depth / 2].map((dz) => (
        <mesh key={`${dx}:${dz}`} position={[dx, 1.19, dz]}>
          <boxGeometry args={[0.032, 2.38, 0.032]} />
          <meshStandardMaterial color={steel} metalness={0.58} roughness={0.28} />
        </mesh>
      )))}
      {[0.14, 0.63, 1.14, 1.67, 2.36].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[0.46, 0.038, depth]} />
          <meshStandardMaterial color={y === 2.36 ? steel : '#473c32'} roughness={0.54} />
        </mesh>
      ))}
      {[-0.42, 0.05].map((dz, i) => (
        <mesh key={dz} position={[0, 1.325, dz]}>
          <boxGeometry args={[0.27, 0.33, 0.35]} />
          <meshStandardMaterial color={i ? '#a99a88' : '#c4bdaf'} roughness={0.93} />
        </mesh>
      ))}
    </group>
  )
}

function WorkshopTable({ z }: { z: number }) {
  const { tableX, tableWidth, tableDepth } = WORKSHOP
  return (
    <group position={[tableX, 0, z]}>
      <mesh position={[0, 0.737, 0]} castShadow receiveShadow>
        <boxGeometry args={[tableWidth, 0.046, tableDepth]} />
        <meshStandardMaterial color={white} roughness={0.48} />
      </mesh>
      {[-1, 1].flatMap((side) => [-1, 1].map((end) => (
        <mesh key={`${side}:${end}`} position={[side * (tableWidth / 2 - 0.1), 0.36, end * (tableDepth / 2 - 0.1)]} castShadow>
          <boxGeometry args={[0.045, 0.72, 0.045]} />
          <meshStandardMaterial color={white} metalness={0.2} roughness={0.42} />
        </mesh>
      )))}
      <mesh position={[0, 0.24, -tableDepth / 2 + 0.1]}>
        <boxGeometry args={[tableWidth - 0.18, 0.04, 0.04]} />
        <meshStandardMaterial color={white} />
      </mesh>
    </group>
  )
}

function WindowChairs() {
  return (
    <group>
      {Array.from({ length: 6 }, (_, i) => (
        <group key={i} position={[-26.72, 0, -15.02 - i * 0.54]} rotation={[0, Math.PI / 2 + (i % 2 ? 0.06 : -0.025), 0]}>
          <mesh position={[0, 0.445, 0]}><boxGeometry args={[0.41, 0.036, 0.38]} /><meshStandardMaterial color={white} roughness={0.55} /></mesh>
          <mesh position={[0, 0.674, -0.194]} rotation={[-0.13, 0, 0]}><boxGeometry args={[0.39, 0.35, 0.028]} /><meshStandardMaterial color={white} roughness={0.53} /></mesh>
          {[-0.167, 0.167].flatMap((x) => [-0.15, 0.15].map((z) => (
            <mesh key={`${x}:${z}`} position={[x, 0.216, z]} rotation={[z * 0.4, 0, x * 0.4]}>
              <cylinderGeometry args={[0.012, 0.009, 0.43, 8]} /><meshStandardMaterial color="#a2a7a8" metalness={0.68} roughness={0.24} />
            </mesh>
          )))}
        </group>
      ))}
      <group position={[-26.6, 0, -14.23]}>
        <mesh position={[0, 0.06, 0]}><cylinderGeometry args={[0.13, 0.19, 0.12, 18]} /><meshStandardMaterial color="#9ca0a1" metalness={0.42} roughness={0.42} /></mesh>
        <mesh position={[0, 1.13, 0]}><cylinderGeometry args={[0.016, 0.017, 2.2, 10]} /><meshStandardMaterial color="#e5e0d5" metalness={0.2} /></mesh>
        {Array.from({ length: 11 }, (_, i) => (
          <mesh key={i} position={[0, 1.14 + i * 0.096, 0]}>
            <cylinderGeometry args={[0.21 - i * 0.019, 0.229 - i * 0.019, 0.096, 9]} />
            <meshStandardMaterial color={i % 2 ? '#d8d4c7' : '#4e5556'} roughness={0.99} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

function LabDisplay() {
  const { x0, x1, y, z0, z1 } = WORKSHOP.labShelf
  const wire = useMemo(() => {
    const points: number[] = []
    const segment = (a: number[], b: number[]) => points.push(...a, ...b)
    for (const x of [-0.18, 0.18]) {
      segment([x * 1.12, 0, 0.19], [x, 0.34, 0.14])
      segment([x * 1.12, 0, -0.19], [x, 0.34, -0.14])
      segment([x * 1.12, 0, -0.19], [x * 1.12, 0, 0.19])
    }
    for (let i = -4; i <= 4; i++) {
      const u = i / 4
      segment([u * 0.19, 0.35, 0.15], [u * 0.176, 0.38, -0.16])
      segment([u * 0.176, 0.38, -0.16], [u * 0.255, 0.71 - 0.047 * u * u, -0.23])
    }
    for (let i = 0; i <= 6; i++) {
      const v = i / 6
      const x = 0.176 + v * 0.079
      segment([-x, 0.38 + v * 0.283, -0.16 - v * 0.07], [0, 0.38 + v * 0.33, -0.16 - v * 0.07])
      segment([0, 0.38 + v * 0.33, -0.16 - v * 0.07], [x, 0.38 + v * 0.283, -0.16 - v * 0.07])
    }
    return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  }, [])
  useEffect(() => () => wire.dispose(), [wire])
  return (
    <group>
      <mesh position={[(x0 + x1) / 2, y + 0.034, (z0 + z1) / 2]}>
        <boxGeometry args={[x1 - x0 + 0.1, 0.068, z1 - z0 + 0.05]} />
        <meshPhysicalMaterial color="#151619" roughness={0.17} clearcoat={0.6} />
      </mesh>
      <mesh position={[(x0 + x1) / 2, 1.86, z0 + 0.011]}>
        <boxGeometry args={[x1 - x0, 2.04, 0.03]} />
        <meshStandardMaterial color="#ddd8cd" roughness={0.81} />
      </mesh>
      {[0.46, 1.34, 2.21, 3.11].map((dx, i) => (
        <group key={dx} position={[x0 + dx, y + 0.07, (z0 + z1) / 2]} rotation={[0, 0.07 - i * 0.04, 0]}>
          <lineSegments geometry={wire}>
            <lineBasicMaterial color={i === 3 ? '#f8f3e6' : '#e3e5e1'} />
          </lineSegments>
          <mesh position={[0, 0.368, -0.005]}>
            <boxGeometry args={[0.29, 0.024, 0.27]} />
            <meshStandardMaterial color={i === 3 ? '#bcb2a2' : '#252527'} roughness={0.91} />
          </mesh>
        </group>
      ))}
      <mesh position={[SHOP.labSign.x0 + 0.24, 1.14, z0 + 0.04]}>
        <boxGeometry args={[0.23, 0.53, 0.075]} />
        <meshStandardMaterial color="#a92722" metalness={0.13} roughness={0.39} />
      </mesh>
      <mesh position={[SHOP.labSign.x0 + 0.24, 1.14, z0 + 0.083]}>
        <cylinderGeometry args={[0.058, 0.058, 0.32, 12]} />
        <meshStandardMaterial color="#de493a" roughness={0.35} />
      </mesh>
    </group>
  )
}

export function Workshop() {
  const { x0, x1, z0, z1, shelfX, shelfZ } = WORKSHOP
  const mesh = useMemo(() => {
    const texture = meshCeilingTexture()
    texture.repeat.set((x1 - x0) / 2.4, (z1 - z0) / 2.4)
    return texture
  }, [x0, x1, z0, z1])
  const rope = useMemo(() => {
    const path = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-24.13, 0.91, -13.31),
      new THREE.Vector3(-22.96, 0.23, -13.47),
      new THREE.Vector3(-21.79, 0.91, -13.31),
    )
    return new THREE.TubeGeometry(path, 24, 0.014, 7, false)
  }, [])
  useEffect(() => () => { mesh.dispose(); rope.dispose() }, [mesh, rope])
  const width = x1 - x0
  return (
    <group>
      <LabDisplay />
      <mesh position={[(x0 + x1) / 2, MAR.westInterior - 0.018, (z0 + z1) / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, z1 - z0]} />
        <meshStandardMaterial map={mesh} alphaTest={0.2} side={THREE.DoubleSide} metalness={0.35} roughness={0.61} />
      </mesh>
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} position={[(x0 + x1) / 2, 3.35 + i * 0.148, z1 + 0.147]}>
          <boxGeometry args={[width, 0.024, 0.041]} />
          <meshStandardMaterial color="#e5ded2" metalness={0.22} roughness={0.59} />
        </mesh>
      ))}
      <mesh position={[(x0 + x1) / 2, 3.3, z1 + 0.17]}>
        <boxGeometry args={[width, 0.16, 0.075]} />
        <meshStandardMaterial color="#e6e0d5" roughness={0.66} />
      </mesh>
      {[-14.2, -16.55, -18.9].map((z) => (
        <mesh key={z} position={[-24.3, 4.89, z]}>
          <boxGeometry args={[3.9, 0.035, 0.055]} />
          <meshStandardMaterial color="#f8f2e8" emissive="#e2eaff" emissiveIntensity={0.95} />
        </mesh>
      ))}
      <pointLight position={[-22.1, 3.75, -15.8]} color="#d8e9ff" intensity={31} distance={13} decay={2} />
      <pointLight position={[-24.65, 3.7, -19.2]} color="#fff0d8" intensity={17} distance={9} decay={2} />
      {WORKSHOP.tables.map((z) => <WorkshopTable key={z} z={z} />)}
      <WindowChairs />
      <Shelf x={shelfX} z={shelfZ} />
      <Shelf x={shelfX} z={-19.13} depth={1.4} />
      <mesh position={[-24.46, 1.3, z0 + 0.22]}>
        <boxGeometry args={[3.13, 1.37, 0.085]} />
        <meshStandardMaterial color="#e5e6e2" roughness={0.78} />
      </mesh>
      {[-24.13, -21.79].map((x) => (
        <group key={x} position={[x, 0, -13.31]}>
          <mesh position={[0, 0.46, 0]}><cylinderGeometry args={[0.025, 0.025, 0.92, 12]} /><meshStandardMaterial color={steel} metalness={0.63} roughness={0.28} /></mesh>
          <mesh position={[0, 0.029, 0]}><cylinderGeometry args={[0.16, 0.17, 0.055, 20]} /><meshStandardMaterial color={steel} roughness={0.43} /></mesh>
        </group>
      ))}
      <mesh geometry={rope}><meshStandardMaterial color="#252425" roughness={0.91} /></mesh>
    </group>
  )
}
