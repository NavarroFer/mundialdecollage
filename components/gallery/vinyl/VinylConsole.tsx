'use client'

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { CanvasTexture, type Group, type MeshStandardMaterial, Raycaster, SRGBColorSpace, Vector2 } from 'three'
import { aimAt } from '../navigation/aim'
import { VINYL, useVinylStore } from './store'

export function VinylConsole({ active }: { active: boolean }) {
  const platter = useRef<Group>(null)
  const front = useRef<MeshStandardMaterial>(null)
  const ray = useRef(new Raycaster())
  const center = useRef(new Vector2())
  useEffect(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 300
    const ctx = canvas.getContext('2d')!
    const metal = ctx.createLinearGradient(0, 0, 0, 300)
    metal.addColorStop(0, '#c9cbc7'); metal.addColorStop(.5, '#e4e4da'); metal.addColorStop(1, '#989b97')
    ctx.fillStyle = metal; ctx.fillRect(0, 0, 1024, 300)
    ctx.fillStyle = '#333a36'; ctx.font = 'bold 28px monospace'; ctx.fillText('MDC / STEREO', 30, 42)
    ctx.strokeStyle = '#666b63'; ctx.strokeRect(25, 67, 340, 190)
    ctx.fillStyle = '#343937'; ctx.fillRect(60, 105, 270, 65)
    ctx.fillStyle = '#b2bf88'; ctx.fillRect(418, 65, 310, 95)
    ctx.fillStyle = '#3c4b31'; ctx.font = 'bold 25px monospace'; ctx.fillText('33⅓  •  HI-FI', 443, 105); ctx.font = '18px monospace'; ctx.fillText('MUNDIAL DE COLLAGE', 435, 140)
    ctx.fillStyle = '#454943'; ctx.fillRect(410, 205, 560, 8)
    for (let i = 0; i < 6; i++) { ctx.fillStyle = '#737871'; ctx.fillRect(420 + i * 85, 238, 60, 20) }
    ctx.font = '18px monospace'; ctx.fillStyle = '#333a36'; ctx.fillText('MUSIC FOR THE GALLERY', 40, 283)
    const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace
    if (front.current) { front.current.map = texture; front.current.needsUpdate = true }
    return () => texture.dispose()
  }, [])
  useFrame(({ camera, scene }, delta) => {
    const state = useVinylStore.getState()
    if (platter.current && state.playing) platter.current.rotation.y += delta * 1.1
    let aiming = false
    if (active) {
      ray.current.setFromCamera(center.current, camera)
      const aim = aimAt(ray.current.intersectObjects(scene.children, true))
      aiming = aim?.kind === 'vinyl' && aim.distance <= 3.5
    }
    if (state.aiming !== aiming) useVinylStore.setState({ aiming })
  })
  useEffect(() => () => useVinylStore.setState({ open: false, aiming: false }), [])
  return <RigidBody type="fixed" colliders={false} position={[VINYL.x, 0, VINYL.z]}>
    <CuboidCollider args={[.525, .69, .4]} position={[0, .69, 0]} />
    <group userData={{ vinyl: true }}>
      <mesh position={[0, .48, 0]} castShadow receiveShadow><boxGeometry args={[.85, .96, .65]} /><meshStandardMaterial color="#574432" roughness={.85} /></mesh>
      <mesh position={[0, 1.08, 0]} castShadow><boxGeometry args={[1.05, .3, .8]} /><meshStandardMaterial color="#542923" roughness={.4} /></mesh>
      <mesh position={[0, 1.08, .405]}><planeGeometry args={[.99, .28]} /><meshStandardMaterial ref={front} metalness={.45} roughness={.35} /></mesh>
      <mesh position={[0, 1.235, 0]}><boxGeometry args={[.98, .025, .74]} /><meshStandardMaterial color="#252826" /></mesh>
      <group ref={platter} position={[-.09, 1.26, 0]}>
        <mesh><cylinderGeometry args={[.31, .31, .025, 64]} /><meshStandardMaterial color="#111313" metalness={.3} roughness={.35} /></mesh>
        {[.15, .2, .25, .29].map((r) => <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, .014, 0]}><ringGeometry args={[r, r + .002, 64]} /><meshStandardMaterial color="#4a4a43" /></mesh>)}
        <mesh position={[0, .016, 0]}><cylinderGeometry args={[.095, .095, .005, 32]} /><meshStandardMaterial color="#dec44c" /></mesh>
        <mesh position={[.045, .02, 0]}><boxGeometry args={[.035, .003, .012]} /><meshStandardMaterial color="#3c3525" /></mesh>
        <mesh position={[0, .027, 0]}><cylinderGeometry args={[.009, .009, .03, 12]} /><meshStandardMaterial color="#c3c6c0" metalness={.8} /></mesh>
      </group>
      <group position={[.36, 1.29, -.23]} rotation={[0, -.35, 0]}>
        <mesh><cylinderGeometry args={[.045, .045, .09, 16]} /><meshStandardMaterial color="#a9adaa" metalness={.7} /></mesh>
        <mesh position={[0, .035, .19]}><boxGeometry args={[.022, .022, .38]} /><meshStandardMaterial color="#c4c8c4" metalness={.8} /></mesh>
        <mesh position={[0, .02, .38]}><boxGeometry args={[.05, .045, .07]} /><meshStandardMaterial color="#a92b22" /></mesh>
      </group>
      <group position={[0, 1.25, -.38]} rotation={[-.25, 0, 0]}>
        <mesh position={[0, .3, 0]}><boxGeometry args={[1.04, .61, .025]} /><meshStandardMaterial color="#667370" transparent opacity={.35} roughness={.2} depthWrite={false} /></mesh>
        {[-.52, .52].map((x) => <mesh key={x} position={[x, .3, 0]}><boxGeometry args={[.025, .63, .03]} /><meshStandardMaterial color="#444a46" /></mesh>)}
        <mesh position={[0, .61, 0]}><boxGeometry args={[1.06, .025, .03]} /><meshStandardMaterial color="#444a46" /></mesh>
      </group>
      {[.31, .43].map((x) => <mesh key={x} position={[x, 1.12, .43]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.04, .04, .04, 24]} /><meshStandardMaterial color="#d1d3cd" metalness={.8} roughness={.25} /></mesh>)}
      <mesh position={[0, .49, .331]}><planeGeometry args={[.65, .58]} /><meshStandardMaterial color="#262823" roughness={1} /></mesh>
      {Array.from({ length: 13 }, (_, i) => <mesh key={i} position={[0, .23 + i * .043, .335]}><boxGeometry args={[.65, .008, .01]} /><meshStandardMaterial color="#6e6552" /></mesh>)}
    </group>
  </RigidBody>
}
