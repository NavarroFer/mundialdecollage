'use client'

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { GALLERY, MAR, MAR_UPPER_ENTRIES, MAR_UPPER_SERVICE } from './layout'
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

/** Permanent doorway details, without the temporary airplanes, figure or exhibition lettering. */
export function UpperHall({ materials }: { materials: InteriorMaterials }) {
  const y = MAR.mezzanine
  const service = MAR_UPPER_SERVICE
  return <group>
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
