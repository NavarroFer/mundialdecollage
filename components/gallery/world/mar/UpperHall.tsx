'use client'

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { GALLERY, MAR, MAR_UPPER_ENTRIES, MAR_UPPER_SERVICE, UPPER_ROOFLIGHT } from './layout'
import type { InteriorMaterials } from './Interior'

/** Gathered velvet at the sides of the existing gallery; the central passage stays open. */
function GalleryCurtains() {
  const geometry = useMemo(() => {
    const mesh = new THREE.PlaneGeometry(0.45, GALLERY.door.height - 0.08, 32, 1)
    const positions = mesh.getAttribute('position')
    for (let i = 0; i < positions.count; i++) {
      positions.setZ(i, Math.sin(positions.getX(i) * 95) * 0.045)
    }
    mesh.computeVertexNormals()
    return mesh
  }, [])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#17191a', roughness: 1, side: THREE.DoubleSide }), [])
  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])
  return <group>
    {[GALLERY.door.z0 + 0.225, GALLERY.door.z1 - 0.225].map((z) => <mesh
      key={z} position={[-11.84, MAR.mezzanine + GALLERY.door.height / 2, z]}
      rotation={[0, Math.PI / 2, 0]} geometry={geometry} material={material} castShadow
    />)}
  </group>
}

/** Powder-coated I sections, glazed panes and adjustable white spots in the entrance bay. */
function EntranceRooflight() {
  const { x0, x1, z0, z1, y } = UPPER_ROOFLIGHT
  const frame = useMemo(() => new THREE.MeshStandardMaterial({ color: '#9da5a6', roughness: 0.46, metalness: 0.35 }), [])
  const glass = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#d5e2e5', transparent: true, opacity: 0.2,
    roughness: 0.12, metalness: 0.08, side: THREE.DoubleSide, depthWrite: false,
  }), [])
  useEffect(() => () => { frame.dispose(); glass.dispose() }, [frame, glass])
  const xs = [x0 + 0.1, (x0 + x1) / 2, x1 - 0.1]
  const zs = [z0 + 0.1, (z0 + z1) / 2, z1 - 0.1]
  const width = xs[2] - xs[0]
  const depth = zs[2] - zs[0]
  return <group>
    {xs.map((x) => <group key={x} position={[x, y, (z0 + z1) / 2]}>
      <mesh material={frame} castShadow><boxGeometry args={[0.035, 0.28, depth + 0.18]} /></mesh>
      {[-0.14, 0.14].map((dy) => <mesh key={dy} position={[0, dy, 0]} material={frame} castShadow>
        <boxGeometry args={[0.18, 0.035, depth + 0.18]} />
      </mesh>)}
    </group>)}
    {zs.map((z) => <group key={z} position={[(x0 + x1) / 2, y, z]}>
      <mesh material={frame} castShadow><boxGeometry args={[width, 0.28, 0.035]} /></mesh>
      {[-0.14, 0.14].map((dy) => <mesh key={dy} position={[0, dy, 0]} material={frame} castShadow>
        <boxGeometry args={[width, 0.035, 0.18]} />
      </mesh>)}
    </group>)}
    {xs.slice(0, -1).flatMap((x, i) => zs.slice(0, -1).map((z, j) => <group key={`${i}-${j}`}>
      <mesh position={[(x + xs[i + 1]) / 2, y + 0.165, (z + zs[j + 1]) / 2]} rotation={[-Math.PI / 2, 0, 0]} material={glass}>
        <planeGeometry args={[xs[i + 1] - x - 0.08, zs[j + 1] - z - 0.08]} />
      </mesh>
      <mesh position={[(x + xs[i + 1]) / 2, y + 0.17, z + 0.055]}>
        <boxGeometry args={[xs[i + 1] - x - 0.08, 0.012, 0.018]} />
        <meshStandardMaterial color="#484e4f" roughness={0.9} />
      </mesh>
    </group>))}
    {/* Track beside the curtain, like the close reference; heads aim into the entrance. */}
    <mesh position={[x0 + 0.3, y - 0.2, (z0 + z1) / 2]} material={frame}>
      <boxGeometry args={[0.06, 0.05, depth]} />
    </mesh>
    {[z0 + 0.65, z1 - 0.65].map((z) => <group key={z} position={[x0 + 0.3, y - 0.22, z]}>
      <mesh position={[0, -0.12, 0]}><boxGeometry args={[0.04, 0.24, 0.05]} /><meshStandardMaterial color="#e1e1dc" roughness={0.55} /></mesh>
      <group position={[0.045, -0.27, 0]} rotation={[0, 0, 0.4]}>
        <mesh castShadow><cylinderGeometry args={[0.085, 0.085, 0.16, 16]} /><meshStandardMaterial color="#e1e1dc" roughness={0.55} /></mesh>
        <mesh position={[0, -0.082, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.063, 16]} /><meshBasicMaterial color="#fff1d9" toneMapped={false} />
        </mesh>
      </group>
    </group>)}
  </group>
}

/** Permanent doorway details, without the temporary airplanes, figure or exhibition lettering. */
export function UpperHall({ materials }: { materials: InteriorMaterials }) {
  const y = MAR.mezzanine
  const service = MAR_UPPER_SERVICE
  return <group>
    <EntranceRooflight />
    <GalleryCurtains />
    <mesh position={[-11.79, y + GALLERY.door.height, (GALLERY.door.z0 + GALLERY.door.z1) / 2]} material={materials.steel}>
      <boxGeometry args={[0.07, 0.06, GALLERY.door.z1 - GALLERY.door.z0]} />
    </mesh>
    {MAR_UPPER_ENTRIES.map((entry) => <group key={entry.id}>
      {/* Dark thresholds end at the existing back wall; the unseen rooms are not extrapolated. */}
      {[entry.x0 + 0.035, entry.x1 - 0.035].map((x) => <mesh key={x} position={[x, y + entry.height / 2, -19.92]} material={materials.steel}>
        <boxGeometry args={[0.07, entry.height, 0.27]} />
      </mesh>)}
      <mesh position={[(entry.x0 + entry.x1) / 2, y + entry.height - 0.035, -19.92]} material={materials.steel}>
        <boxGeometry args={[entry.x1 - entry.x0, 0.07, 0.27]} />
      </mesh>
    </group>)}
    <group position={[(service.x0 + service.x1) / 2, y, -19.85]}>
      <mesh position={[0, service.height / 2, -0.08]}>
        <boxGeometry args={[service.x1 - service.x0 - 0.09, service.height - 0.04, 0.06]} />
        <meshStandardMaterial color="#bfc0ba" roughness={0.6} />
      </mesh>
      <mesh position={[0.35, 1.03, -0.025]} material={materials.steel}><boxGeometry args={[0.12, 0.025, 0.035]} /></mesh>
      <mesh position={[0.35, 1.01, -0.045]} material={materials.steel}><boxGeometry args={[0.035, 0.16, 0.02]} /></mesh>
    </group>
  </group>
}
