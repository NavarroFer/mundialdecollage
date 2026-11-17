'use client'

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { MAR_ESCALATORS } from './layout'
import type { InteriorMaterials } from './Interior'

type Lane = (typeof MAR_ESCALATORS)[number]

const run = (lane: Lane) => Math.abs(lane.xTop - lane.xBottom)
const width = (lane: Lane) => lane.z1 - lane.z0

/**
 * One escalator drawn in its own frame: the foot at the origin, rising along +X
 * to the head at (run, rise), its width across Z. The group turns it to face
 * the way the lane rises.
 */
function laneGeometry(lane: Lane) {
  const length = run(lane)
  // Side profile in the XY plane, extruded across Z into a thin panel.
  function profile(glass: boolean) {
    const shape = new THREE.Shape()
    const lower = glass ? 0.24 : -0.58
    const upper = glass ? 1.03 : 0.29
    shape.moveTo(-0.65, 0.06)
    shape.lineTo(0, lower)
    shape.lineTo(length, lane.rise + lower)
    shape.lineTo(length + 0.65, lane.rise + lower)
    shape.quadraticCurveTo(length + 1.0, lane.rise + 0.55, length + 0.6, lane.rise + upper)
    shape.lineTo(length, lane.rise + upper)
    shape.lineTo(0, upper)
    shape.quadraticCurveTo(-1, upper, -0.65, 0.06)
    const depth = glass ? 0.025 : 0.075
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 12 })
    g.translate(0, 0, -depth / 2)
    return g
  }
  const handrail = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.62, 0.22, 0),
    new THREE.Vector3(-0.78, 0.78, 0),
    new THREE.Vector3(-0.35, 1.04, 0),
    new THREE.Vector3(0, 1.05, 0),
    new THREE.Vector3(length, lane.rise + 1.05, 0),
    new THREE.Vector3(length + 0.55, lane.rise + 1.05, 0),
    new THREE.Vector3(length + 0.85, lane.rise + 0.85, 0),
    new THREE.Vector3(length + 0.65, lane.rise + 0.3, 0),
  ], false, 'centripetal')
  const steps: THREE.BufferGeometry[] = []
  const count = 28
  const depth = length / count
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count
    const step = new THREE.BoxGeometry(depth + 0.005, lane.rise / count, width(lane) - 0.13)
    step.translate(length * t, lane.rise * t - 0.06, 0)
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
      const length = run(lane)
      const across = width(lane)
      const slope = Math.hypot(length, lane.rise)
      // Local +X points from the foot toward the head: east as drawn, turned half round when the lane rises west.
      const yaw = lane.xTop > lane.xBottom ? 0 : Math.PI
      return <group key={lane.id} position={[lane.xBottom, 0, (lane.z0 + lane.z1) / 2]} rotation={[0, yaw, 0]}>
        <mesh geometry={geometry.stair} material={steps} castShadow receiveShadow />
        <mesh position={[length / 2, lane.rise / 2 - 0.4, 0]} rotation={[0, 0, Math.atan(lane.rise / length)]} material={materials.steel} castShadow>
          <boxGeometry args={[slope, 0.6, across + 0.12]} />
        </mesh>
        {[-(across / 2 + 0.04), across / 2 + 0.04].map((z) => <group key={z} position={[0, 0, z]}>
          <mesh geometry={geometry.skirt} material={materials.steel} castShadow />
          <mesh geometry={geometry.glass} material={materials.glass} />
          <mesh geometry={geometry.handrail} material={materials.mullion} />
        </group>)}
        {[0, length].map((x, i) => <mesh key={i} position={[x, (i ? lane.rise : 0) + 0.025, 0]} material={steps} receiveShadow>
          <boxGeometry args={[0.5, 0.04, across]} />
        </mesh>)}
      </group>
    })}
  </group>
}
