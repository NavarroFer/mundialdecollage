'use client'

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { MAR_ESCALATORS } from './layout'
import type { InteriorMaterials } from './Interior'

type Lane = (typeof MAR_ESCALATORS)[number]

function laneGeometry(lane: Lane) {
  const direction = Math.sign(lane.zTop - lane.zBottom)
  const z = (t: number) => THREE.MathUtils.lerp(lane.zBottom, lane.zTop, t)
  // Side profiles in (-Z,Y), then rotated about Y into a thin X section.
  function profile(glass: boolean) {
    const shape = new THREE.Shape()
    const lower = glass ? 0.24 : -0.58
    const upper = glass ? 1.03 : 0.29
    shape.moveTo(-(z(0) - direction * 0.65), 0.06)
    shape.lineTo(-z(0), lower)
    shape.lineTo(-z(1), lane.rise + lower)
    shape.lineTo(-(z(1) + direction * 0.65), lane.rise + lower)
    shape.quadraticCurveTo(-(z(1) + direction * 1.0), lane.rise + 0.55, -(z(1) + direction * 0.6), lane.rise + upper)
    shape.lineTo(-z(1), lane.rise + upper)
    shape.lineTo(-z(0), upper)
    shape.quadraticCurveTo(-(z(0) - direction * 1), upper, -(z(0) - direction * 0.65), 0.06)
    const g = new THREE.ExtrudeGeometry(shape, { depth: glass ? 0.025 : 0.075, bevelEnabled: false, curveSegments: 12 })
    g.rotateY(Math.PI / 2)
    return g
  }
  const handrail = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.22, z(0) - direction * 0.62),
    new THREE.Vector3(0, 0.78, z(0) - direction * 0.78),
    new THREE.Vector3(0, 1.04, z(0) - direction * 0.35),
    new THREE.Vector3(0, 1.05, z(0)),
    new THREE.Vector3(0, lane.rise + 1.05, z(1)),
    new THREE.Vector3(0, lane.rise + 1.05, z(1) + direction * 0.55),
    new THREE.Vector3(0, lane.rise + 0.85, z(1) + direction * 0.85),
    new THREE.Vector3(0, lane.rise + 0.3, z(1) + direction * 0.65),
  ], false, 'centripetal')
  const steps: THREE.BufferGeometry[] = []
  const count = 28
  const depth = Math.abs(lane.zTop - lane.zBottom) / count
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count
    const step = new THREE.BoxGeometry(lane.x1 - lane.x0 - 0.13, lane.rise / count, depth + 0.005)
    step.translate((lane.x0 + lane.x1) / 2, lane.rise * t - 0.06, z(t))
    steps.push(step)
  }
  const stair = mergeGeometries(steps)!
  steps.forEach((g) => g.dispose())
  return { skirt: profile(false), glass: profile(true), handrail: new THREE.TubeGeometry(handrail, 80, 0.043, 10, false), stair }
}

export function Escalators({ materials, steps }: { materials: InteriorMaterials; steps: THREE.Material }) {
  const geometries = useMemo(() => MAR_ESCALATORS.map(laneGeometry), [])
  useEffect(() => () => geometries.forEach((set) => Object.values(set).forEach((g) => g.dispose())), [geometries])
  return <group>
    {MAR_ESCALATORS.map((lane, index) => {
      const geometry = geometries[index]
      const run = lane.zBottom - lane.zTop
      const length = Math.hypot(run, lane.rise)
      return <group key={lane.id}>
        <mesh geometry={geometry.stair} material={steps} castShadow receiveShadow />
        <mesh position={[(lane.x0 + lane.x1) / 2, lane.rise / 2 - 0.4, (lane.zBottom + lane.zTop) / 2]} rotation={[Math.atan(lane.rise / run), 0, 0]} material={materials.steel} castShadow>
          <boxGeometry args={[lane.x1 - lane.x0 + 0.12, 0.6, length]} />
        </mesh>
        {[lane.x0 - 0.05, lane.x1 + 0.025].map((x) => <group key={x} position={[x, 0, 0]}>
          <mesh geometry={geometry.skirt} material={materials.steel} castShadow />
          <mesh geometry={geometry.glass} material={materials.glass} />
          <mesh geometry={geometry.handrail} material={materials.mullion} />
        </group>)}
        {[lane.zBottom, lane.zTop].map((z, i) => <mesh key={i} position={[(lane.x0 + lane.x1) / 2, (i ? lane.rise : 0) + 0.025, z]} material={steps} receiveShadow>
          <boxGeometry args={[lane.x1 - lane.x0, 0.04, 0.5]} />
        </mesh>)}
      </group>
    })}
  </group>
}
