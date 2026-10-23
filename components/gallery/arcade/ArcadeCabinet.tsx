'use client'

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { CanvasTexture, MeshStandardMaterial, Raycaster, SRGBColorSpace, Vector2 } from 'three'
import { ARCADE, useArcadeStore } from './store'

export function ArcadeCabinet({ active }: { active: boolean }) {
  const face = useRef<MeshStandardMaterial>(null)
  const ray = useRef(new Raycaster())
  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512; canvas.height = 1024
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#e9bc26'; ctx.fillRect(0, 0, 512, 1024)
    ctx.fillStyle = '#20190f'; ctx.textAlign = 'center'; ctx.font = 'bold 68px monospace'; ctx.fillText('SNAKE', 256, 100)
    ctx.fillStyle = '#201b17'; ctx.fillRect(42, 145, 428, 410)
    ctx.fillStyle = '#090e18'; ctx.fillRect(65, 168, 382, 360)
    ctx.strokeStyle = '#141c28'; ctx.lineWidth = 3
    for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.moveTo(65 + i * 42, 168); ctx.lineTo(65 + i * 42, 528); ctx.stroke(); ctx.beginPath(); ctx.moveTo(65, 168 + i * 40); ctx.lineTo(447, 168 + i * 40); ctx.stroke() }
    ctx.fillStyle = '#72dd3e'
    for (const [x, y] of [[0, 5], [1, 5], [2, 5], [3, 5], [3, 4], [3, 3], [2, 3], [1, 3], [1, 2], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1]]) ctx.fillRect(82 + x * 43, 185 + y * 42, 35, 34)
    ctx.fillStyle = '#ef3435'; ctx.fillRect(377, 395, 32, 32)
    ctx.fillStyle = '#e6f28a'; ctx.font = 'bold 20px monospace'; ctx.fillText('PRESS START', 256, 505)
    ctx.fillStyle = '#bc9b70'; ctx.fillRect(40, 605, 432, 155)
    ctx.fillStyle = '#26221d'; ctx.font = 'bold 20px monospace'; ctx.fillText('FREE PLAY · MDC', 256, 700)
    ctx.fillStyle = '#442c1c'; ctx.fillRect(0, 805, 512, 219)
    for (let x = 0; x < 512; x += 5) { ctx.fillStyle = `rgba(190,133,68,${0.08 + (Math.sin(x * 2) + 1) * 0.08})`; ctx.fillRect(x, 805, 2, 219) }
    ctx.fillStyle = '#24211e'; ctx.fillRect(350, 845, 95, 135); ctx.fillStyle = '#ada38b'; ctx.fillRect(387, 862, 20, 5)
    const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace
    if (face.current) { face.current.map = texture; face.current.needsUpdate = true }
    return () => texture.dispose()
  }, [])
  useFrame(({ camera, scene }) => {
    let aiming = false
    if (active) {
      ray.current.setFromCamera(new Vector2(0, 0), camera)
      const hit = ray.current.intersectObjects(scene.children, true).find(({ object }) => !object.userData.navigationMarker)
      if (hit && hit.distance <= 3.5) {
        for (let object = hit.object; object; object = object.parent!) if (object.userData.arcade) aiming = true
      }
    }
    if (useArcadeStore.getState().aiming !== aiming) useArcadeStore.getState().setAiming(aiming)
  })
  useEffect(() => () => useArcadeStore.setState({ aiming: false, open: false }), [])
  return (
    <RigidBody type="fixed" colliders={false} position={[ARCADE.x, 0, ARCADE.z]}>
      <CuboidCollider args={[0.475, 0.95, 0.4]} position={[0, 0.95, 0]} />
      <group userData={{ arcade: true }}>
        <mesh position={[0, 0.95, 0]} castShadow receiveShadow><boxGeometry args={[0.95, 1.9, 0.8]} /><meshStandardMaterial color="#49301e" roughness={0.8} /></mesh>
        <mesh position={[0, 0.98, 0.406]}><planeGeometry args={[0.85, 1.8]} /><meshStandardMaterial ref={face} roughness={0.65} emissive="#fff0a0" emissiveIntensity={0.1} /></mesh>
        {[-0.46, 0.46].map((x) => <mesh key={x} position={[x, 0.98, 0.43]}><boxGeometry args={[0.045, 1.88, 0.055]} /><meshStandardMaterial color="#211d17" /></mesh>)}
        <mesh position={[0, 0.65, 0.49]} rotation={[-0.15, 0, 0]}><boxGeometry args={[0.85, 0.075, 0.3]} /><meshStandardMaterial color="#d6ac25" /></mesh>
        <mesh position={[-0.23, 0.73, 0.53]}><sphereGeometry args={[0.05, 12, 8]} /><meshStandardMaterial color="#171a17" /></mesh>
        <mesh position={[0.23, 0.71, 0.54]}><cylinderGeometry args={[0.045, 0.045, 0.035, 16]} /><meshStandardMaterial color="#dd3d27" /></mesh>
        <mesh position={[0, 1.94, 0]}><boxGeometry args={[1.02, 0.08, 0.87]} /><meshStandardMaterial color="#211d17" /></mesh>
      </group>
    </RigidBody>
  )
}
