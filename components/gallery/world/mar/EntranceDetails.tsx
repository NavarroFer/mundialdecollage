'use client'

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { canvasOf, canvasTexture } from './textures'
import { grateTexture } from './interiorDecals'

/** The museum's own turquoise roll-up, visible immediately to the right. */
export function entranceBannerTexture(poster = false) {
  const { canvas, context: c } = canvasOf(512, poster ? 720 : 1200)
  const h = canvas.height
  c.fillStyle = poster ? '#c1b58e' : '#eef2eb'
  c.fillRect(0, 0, 512, h)
  c.fillStyle = '#14b8cf'
  c.fillRect(0, 0, 512, poster ? 80 : 270)
  c.textAlign = 'center'
  c.fillStyle = '#ffffff'
  c.font = 'bold 55px Arial'
  if (poster) {
    c.font = 'bold 34px Arial'
    c.fillText('MAR', 256, 55)
    c.fillStyle = '#514a3c'
    c.font = 'bold 35px Arial'
    c.fillText('RECORRIDOS', 256, 200)
    c.fillText('PARTICIPATIVOS', 256, 245)
    c.font = '24px Arial'
    c.fillText('Museo de Arte Contemporáneo', 256, 325)
    c.fillText('Buenos Aires', 256, 360)
    c.fillStyle = '#459cab'
    c.fillRect(25, h - 160, 462, 125)
    c.fillStyle = '#ffffff'
    c.fillText('INSTITUTO CULTURAL', 256, h - 90)
  } else {
    c.fillText('INSTITUTO', 256, 125)
    c.fillText('CULTURAL', 256, 190)
    // Restrained line drawing in the centre, rather than invented small print.
    c.strokeStyle = '#1895b6'
    c.lineWidth = 3
    for (let i = 0; i < 10; i++) {
      c.beginPath()
      c.arc(256, 570, 55 + i * 12, -0.3, Math.PI * 1.25)
      c.stroke()
    }
    c.textAlign = 'left'
    c.fillStyle = '#6c8c92'
    c.font = '33px Arial'
    c.fillText('GOBIERNO DE LA', 60, 900)
    c.fillText('PROVINCIA DE', 60, 945)
    c.fillStyle = '#12b6d0'
    c.font = 'bold 62px Arial'
    c.fillText('BUENOS', 60, 1020)
    c.fillText('AIRES', 60, 1095)
  }
  return canvasTexture(canvas, false)
}

function textTexture(lines: string[], background = '#eeeee8', color = '#404448') {
  const { canvas, context } = canvasOf(512, 256)
  context.fillStyle = background
  context.fillRect(0, 0, 512, 256)
  context.fillStyle = color
  context.textAlign = 'center'
  context.font = 'bold 40px Arial'
  lines.forEach((line, i) => context.fillText(line, 256, 100 + i * 55))
  return canvasTexture(canvas, false)
}

function Pipe({ points, radius, color = '#313333' }: { points: [number, number, number][]; radius: number; color?: string }) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)))
    return new THREE.TubeGeometry(curve, Math.max(8, points.length * 8), radius, 8, false)
  }, [points, radius])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} castShadow><meshStandardMaterial color={color} roughness={0.48} metalness={0.35} /></mesh>
}

/** Open red cabinet, coiled white hose, supply pipe and glazed extinguisher box. */
function FireEquipment({ position, yaw = 0, small = false }: { position: [number, number, number]; yaw?: number; small?: boolean }) {
  return (
    <group position={position} rotation={[0, yaw, 0]} scale={small ? 0.85 : 1}>
      <mesh position={[0, 1.35, -0.06]}><boxGeometry args={[0.7, 0.72, 0.14]} /><meshStandardMaterial color="#981813" roughness={0.48} /></mesh>
      {[[0, 1.7, 0.7, 0.035], [0, 1, 0.7, 0.035], [-0.34, 1.35, 0.035, 0.7], [0.34, 1.35, 0.035, 0.7]].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0.05]}><boxGeometry args={[w, h, 0.1]} /><meshStandardMaterial color="#db3024" roughness={0.38} /></mesh>
      ))}
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[0.04, 1.32, 0.065]}><torusGeometry args={[0.035 + i * 0.018, 0.012, 6, 48]} /><meshStandardMaterial color="#dedbd0" roughness={0.94} /></mesh>
      ))}
      <Pipe points={[[-0.31, 0.07, -0.02], [-0.31, 1.4, -0.02], [-0.2, 1.6, 0]]} radius={0.034} color="#bb2c20" />
      {!small && <group position={[0.63, 1.33, 0]}>
        <mesh><boxGeometry args={[0.32, 0.74, 0.16]} /><meshStandardMaterial color="#ba211c" roughness={0.45} /></mesh>
        <mesh position={[0, 0, 0.087]}><planeGeometry args={[0.25, 0.65]} /><meshStandardMaterial color="#acd0dc" transparent opacity={0.48} roughness={0.16} /></mesh>
        <mesh position={[0, -0.06, 0.095]}><cylinderGeometry args={[0.055, 0.055, 0.37, 16]} /><meshStandardMaterial color="#d63829" roughness={0.4} /></mesh>
      </group>}
    </group>
  )
}

function butterflySeatGeometry() {
  const geometry = new THREE.PlaneGeometry(1, 1, 24, 24)
  const p = geometry.getAttribute('position')
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) * 2
    const v = p.getY(i) * 2
    const x = u * (0.4 + 0.1 * v * v)
    const y = 0.42 + 0.2 * u * u + 0.32 * Math.pow(Math.max(0, v), 1.4) + 0.03 * v * v
    p.setXYZ(i, x, y, -0.4 * v)
  }
  geometry.computeVertexNormals()
  return geometry
}

function ButterflyChair({ x, yaw }: { x: number; yaw: number }) {
  const geometry = useMemo(() => butterflySeatGeometry(), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <group position={[x, 0, -0.91]} rotation={[0, yaw, 0]}>
      <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial color="#744a35" roughness={0.7} side={THREE.DoubleSide} /></mesh>
      {[-1, 1].map((side) => <group key={side}>
        <Pipe points={[[side * 0.48, 0.95, -0.4], [side * 0.42, 0.07, 0.35], [-side * 0.4, 0.07, 0.35], [-side * 0.48, 0.64, 0.4]]} radius={0.012} />
        <Pipe points={[[side * 0.48, 0.64, 0.4], [side * 0.4, 0.06, -0.35], [-side * 0.4, 0.06, -0.35], [-side * 0.48, 0.95, -0.4]]} radius={0.012} />
      </group>)}
    </group>
  )
}

/** A recessed track of pairs of warm lamps, flush with the low concrete ceiling. */
function EntranceLights() {
  return <>
    {[-2.3, -6.9].map((x) => <group key={x} position={[x, 4.29, -2.3]}>
      <mesh><boxGeometry args={[0.26, 0.035, 3.8]} /><meshStandardMaterial color="#999992" roughness={0.65} /></mesh>
      {[-1.35, 0, 1.35].map((z) => <group key={z} position={[0, -0.025, z]}>
        <mesh><boxGeometry args={[0.24, 0.04, 0.46]} /><meshStandardMaterial color="#454643" /></mesh>
        {[-0.115, 0.115].map((dz) => <mesh key={dz} position={[0, -0.026, dz]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.078, 16]} /><meshStandardMaterial color="#fff2b5" emissive="#ffba50" emissiveIntensity={2} toneMapped={false} /></mesh>)}
      </group>)}
    </group>)}
    <pointLight position={[5.9, 3.9, -3.2]} intensity={11} color="#ffd7a0" distance={11} decay={2} />
    <pointLight position={[-6.3, 3.8, -2.7]} intensity={9} color="#ffe1b5" distance={10} decay={2} />
  </>
}

export function EntranceDetails() {
  const textures = useMemo(() => ({ grate: grateTexture(), mar: textTexture(['MAR', 'MUSEO DE ARTE CONTEMPORÁNEO'], '#bcb7ab', '#ffffff'), fire: textTexture(['BOCA DE', 'INCENDIO']), lab: textTexture(['‹ ESPACIO LABORATORIO', '‹ LA ISLA']), information: textTexture(['MAR', 'INFORMACIÓN']) }), [])
  useEffect(() => () => Object.values(textures).forEach((texture) => texture.dispose()), [textures])
  const grate = useMemo(() => { const copy = textures.grate.clone(); copy.repeat.set(9, 1); return copy }, [textures.grate])
  useEffect(() => () => grate.dispose(), [grate])
  return <group>
    <EntranceLights />
    <Pipe points={[[7.61, 0.06, -6.7], [7.61, 4.31, -6.7]]} radius={0.018} color="#b9beb9" />
    <mesh position={[7.55, 1.35, -6.7]} rotation={[0, -Math.PI / 2, 0]}><boxGeometry args={[0.82, 1.17, 0.035]} /><meshStandardMaterial color="#343c3b" roughness={0.45} /></mesh>
    {/* Wall on the right when crossing the entry door. Local +Z faces visitors. */}
    <group position={[8.13, 0, -3.1]} rotation={[0, -Math.PI / 2, 0]}>
      <FireEquipment position={[-0.6, 0, 0]} />
      <mesh position={[-0.6, 2.03, 0.035]}><planeGeometry args={[0.33, 0.23]} /><meshStandardMaterial map={textures.fire} /></mesh>
      <mesh position={[-0.2, 0.048, 0.38]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[7, 0.3]} /><meshStandardMaterial map={grate} roughness={0.6} metalness={0.3} /></mesh>
      <group position={[1.0, 0, 0.62]}>
        <mesh position={[0, 0.02, 0]}><cylinderGeometry args={[0.19, 0.19, 0.04, 32]} /><meshStandardMaterial color="#242625" metalness={0.3} roughness={0.5} /></mesh>
        <mesh position={[0, 0.62, 0]}><boxGeometry args={[0.035, 1.24, 0.035]} /><meshStandardMaterial color="#242625" /></mesh>
        <mesh position={[0, 1.32, 0]}><planeGeometry args={[0.23, 0.27]} /><meshStandardMaterial map={textures.information} side={THREE.DoubleSide} /></mesh>
      </group>
      {/* The double emergency fixture and red sounder high on the wall. */}
      <mesh position={[-0.8, 3.95, 0.07]}><boxGeometry args={[0.28, 0.16, 0.15]} /><meshStandardMaterial color="#191b1c" /></mesh>
      {[-0.1, 0.1].map((x) => <mesh key={x} position={[-0.8 + x, 3.95, 0.16]} rotation={[Math.PI / 2, 0, x]}><cylinderGeometry args={[0.065, 0.07, 0.08, 16]} /><meshStandardMaterial color="#e2e4db" roughness={0.3} /></mesh>)}
    </group>
    {/* Brown sling chairs and a small pale table beside the entry glass. */}
    <ButterflyChair x={-6.4} yaw={0.1} />
    <ButterflyChair x={-3.9} yaw={-0.15} />
    <mesh position={[-5.2, 0.4, -0.95]} castShadow><boxGeometry args={[0.86, 0.035, 0.58]} /><meshStandardMaterial color="#b29b71" roughness={0.62} /></mesh>
    {[-0.38, 0.38].flatMap((dx) => [-0.23, 0.23].map((dz) => <mesh key={`${dx}:${dz}`} position={[-5.2 + dx, 0.2, -0.95 + dz]}><boxGeometry args={[0.022, 0.4, 0.022]} /><meshStandardMaterial color="#262727" /></mesh>))}
    <mesh position={[-5.2, 2.12, -0.315]} rotation={[0, Math.PI, 0]}><planeGeometry args={[0.34, 0.17]} /><meshStandardMaterial map={textures.mar} /></mesh>
    <FireEquipment position={[-7.18, 0, -0.32]} yaw={Math.PI} small />
    {/* Aluminium framing keeps the blue screen a flat glazed partition. */}
    {[-9.9, -9.03, -8.17, -7.3].map((x) => <mesh key={x} position={[x, 2.1, -1.63]}><boxGeometry args={[0.045, 4.2, 0.055]} /><meshStandardMaterial color="#b7bec0" metalness={0.6} roughness={0.35} /></mesh>)}
    {[0.1, 1.7, 3.3, 4.2].map((y) => <mesh key={y} position={[-8.6, y, -1.63]}><boxGeometry args={[2.6, 0.045, 0.055]} /><meshStandardMaterial color="#b7bec0" metalness={0.6} roughness={0.35} /></mesh>)}
    {/* Closed service door beside the broad café passage. */}
    <group position={[-11.82, 0, -6.9]} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, 1.25, 0]}><boxGeometry args={[0.95, 2.5, 0.05]} /><meshStandardMaterial color="#e5e4dc" roughness={0.7} /></mesh>
      <mesh position={[0, 2.95, 0.03]}><planeGeometry args={[1.1, 0.4]} /><meshStandardMaterial map={textures.lab} /></mesh>
      <mesh position={[0.34, 1.15, 0.06]}><boxGeometry args={[0.12, 0.03, 0.04]} /><meshStandardMaterial color="#272b2b" /></mesh>
    </group>
  </group>
}
