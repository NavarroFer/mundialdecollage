'use client'

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { MAR, MAR_BANNERS, STAIR, type MarBanner } from './layout'
import {
  bancoPanelTexture,
  biformesPosterTexture,
  cafeEmblemTexture,
  exitSignTexture,
  maquinasPosterTexture,
  noeBannerTexture,
  provinciaLogoTexture,
  tactileTexture,
} from './decals'
import { standeeTexture } from './interiorDecals'
import { louvreTexture } from './textures'

// Everything printed, painted or fitted on the faces of the volumes: the mark
// over the doors, the banners, the revolving door, the vent housing and the
// stair. Colliders for these live in layout.ts; none of this is solid.

/** What each banner slot shows until an image is set on it in layout.ts. */
const STAND_INS: Record<string, () => THREE.Texture> = {
  'door-a': biformesPosterTexture,
  'door-b': bancoPanelTexture,
  'door-c': maquinasPosterTexture,
  vinyl: noeBannerTexture,
  'standee-a': standeeTexture,
  'standee-b': standeeTexture,
  'standee-c': standeeTexture,
}

function useBannerTextures(banners: MarBanner[]) {
  const textures = useMemo(() => banners.map((banner) => {
    if (banner.image) {
      const texture = new THREE.TextureLoader().load(banner.image)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = 8
      return texture
    }
    return STAND_INS[banner.id]?.() ?? null
  }), [banners])
  useEffect(() => () => textures.forEach((texture) => texture?.dispose()), [textures])
  return textures
}

function Banners() {
  const textures = useBannerTextures(MAR_BANNERS)
  return MAR_BANNERS.map((banner, index) => {
    const map = textures[index]
    const material = (
      <meshStandardMaterial map={map} color={map ? '#ffffff' : '#f4f3ef'} roughness={0.55} polygonOffset polygonOffsetFactor={-1} />
    )
    if (banner.standee) {
      // A roll-up on its base: printed both sides, a steel foot, a pole behind.
      return (
        <group key={banner.id} position={[banner.center[0], banner.center[1] - banner.height / 2 - 0.05, banner.center[2]]} rotation={[0, banner.yaw ?? 0, 0]}>
          <mesh position={[0, banner.height / 2 + 0.1, 0]}>
            <planeGeometry args={[banner.width, banner.height]} />
            {material}
          </mesh>
          <mesh position={[0, banner.height / 2 + 0.1, -0.004]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[banner.width, banner.height]} />
            <meshStandardMaterial color="#e9eef0" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.04, 0]}>
            <boxGeometry args={[banner.width + 0.1, 0.07, 0.16]} />
            <meshStandardMaterial color="#b9bdc0" roughness={0.4} metalness={0.3} />
          </mesh>
        </group>
      )
    }
    return (
      <mesh key={banner.id} position={banner.center} rotation={[0, banner.yaw ?? 0, 0]}>
        <planeGeometry args={[banner.width, banner.height]} />
        {material}
      </mesh>
    )
  })
}

/** A flat decal: a plane on a face, lit like the wall it is on. */
function Decal({ texture, position, size, rotation = [0, 0, 0], basic = false }: { texture: THREE.Texture; position: [number, number, number]; size: [number, number]; rotation?: [number, number, number]; basic?: boolean }) {
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={size} />
      {basic ? (
        <meshBasicMaterial map={texture} transparent toneMapped={false} />
      ) : (
        <meshStandardMaterial map={texture} transparent roughness={0.9} polygonOffset polygonOffsetFactor={-1} />
      )}
    </mesh>
  )
}

/**
 * A black revolving door in a half-drum of curved glass, set in the front of
 * the door bank. Its drum bulges out from the glass line toward the plaza.
 */
function RevolvingDoor({ materials }: { materials: { glass: THREE.Material; mullion: THREE.Material } }) {
  const radius = 1.25
  const centre: [number, number, number] = [-4, 0, 0.9]
  const height = MAR.doorLeaf
  return (
    <group position={centre}>
      {/* Curved glass walls, front half. */}
      <mesh position={[0, height / 2, 0]} material={materials.glass}>
        <cylinderGeometry args={[radius, radius, height - 0.5, 28, 1, true, -Math.PI / 2 - 0.15, Math.PI + 0.3]} />
      </mesh>
      {/* Canopy and base ring. */}
      <mesh position={[0, height + 0.12, 0]} material={materials.mullion}>
        <cylinderGeometry args={[radius + 0.04, radius + 0.04, 0.34, 28, 1, false, -Math.PI / 2 - 0.15, Math.PI + 0.3]} />
      </mesh>
      <mesh position={[0, height + 0.12, -0.5]} material={materials.mullion}>
        <boxGeometry args={[radius * 2 + 0.08, 0.34, 1]} />
      </mesh>
      <mesh position={[0, 0.12, 0]} material={materials.mullion}>
        <cylinderGeometry args={[radius + 0.04, radius + 0.04, 0.24, 28, 1, false, -Math.PI / 2 - 0.15, Math.PI + 0.3]} />
      </mesh>
      {/* Centre post, and four leaves a little off-axis as if it were turning. */}
      <mesh position={[0, height / 2, 0]} material={materials.mullion}>
        <cylinderGeometry args={[0.05, 0.05, height, 10]} />
      </mesh>
      {[0.3, 0.3 + Math.PI / 2, 0.3 + Math.PI, 0.3 + (3 * Math.PI) / 2].map((angle) => (
        <group key={angle} rotation={[0, angle, 0]}>
          <mesh position={[radius / 2, height / 2, 0]} material={materials.glass}>
            <boxGeometry args={[radius - 0.08, height - 0.4, 0.02]} />
          </mesh>
          <mesh position={[radius - 0.04, height / 2, 0]} material={materials.mullion}>
            <boxGeometry args={[0.06, height - 0.3, 0.06]} />
          </mesh>
        </group>
      ))}
      {/* Two uprights at the mouth of the drum. */}
      {[-radius, radius].map((x) => (
        <mesh key={x} position={[x, height / 2, 0]} material={materials.mullion}>
          <boxGeometry args={[0.08, height, 0.08]} />
        </mesh>
      ))}
    </group>
  )
}

/** Recessed square downlights in the soffit over the doors, as in the close-up. */
function Downlights({ materials }: { materials: { mullion: THREE.Material; lamp: THREE.Material } }) {
  return (
    <>
      {[[-1.2, 1.55], [-8, 1.55]].map(([x, z]) => (
        <group key={x} position={[x, MAR.soffit - 0.02, z]}>
          <mesh material={materials.mullion}>
            <boxGeometry args={[0.95, 0.04, 0.95]} />
          </mesh>
          {[[-0.22, -0.22], [0.22, -0.22], [0.22, 0.22], [-0.22, 0.22]].map(([dx, dz]) => (
            <mesh key={`${dx}${dz}`} position={[dx, -0.03, dz]} material={materials.lamp}>
              <sphereGeometry args={[0.07, 8, 6]} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  )
}

function StairWell({ materials }: { materials: { concrete: THREE.Material; void: THREE.Material; steel: THREE.Material } }) {
  const steps = 9
  const run = STAIR.z1 - STAIR.z0
  const width = STAIR.x1 - STAIR.x0
  const rise = STAIR.depth / steps
  const tread = run / steps
  return (
    <group>
      {/* Walls of the shaft, below the paving. */}
      <mesh position={[(STAIR.x0 + STAIR.x1) / 2, -STAIR.depth / 2, STAIR.z0 - 0.05]} material={materials.concrete}>
        <boxGeometry args={[width, STAIR.depth, 0.1]} />
      </mesh>
      <mesh position={[STAIR.x0 - 0.05, -STAIR.depth / 2, (STAIR.z0 + STAIR.z1) / 2]} material={materials.concrete}>
        <boxGeometry args={[0.1, STAIR.depth, run]} />
      </mesh>
      <mesh position={[STAIR.x1 + 0.05, -STAIR.depth / 2, (STAIR.z0 + STAIR.z1) / 2]} material={materials.concrete}>
        <boxGeometry args={[0.1, STAIR.depth, run]} />
      </mesh>
      {/* Descending toward the building. */}
      {Array.from({ length: steps }, (_, index) => (
        <mesh key={index} position={[(STAIR.x0 + STAIR.x1) / 2, -(index + 1) * rise + rise / 2 - 0.05, STAIR.z1 - (index + 0.5) * tread]} material={materials.concrete}>
          <boxGeometry args={[width - 0.04, rise, tread]} />
        </mesh>
      ))}
      <mesh position={[(STAIR.x0 + STAIR.x1) / 2, -STAIR.depth - 0.05, STAIR.z0 + 0.15]} material={materials.void}>
        <boxGeometry args={[width - 0.04, 0.1, 0.3]} />
      </mesh>
      {/* Steel rail across the open end, and along the wall. */}
      <mesh position={[(STAIR.x0 + STAIR.x1) / 2, 1.0, STAIR.z1 + 0.02]} rotation={[0, 0, Math.PI / 2]} material={materials.steel}>
        <cylinderGeometry args={[0.025, 0.025, width, 8]} />
      </mesh>
      <mesh position={[STAIR.x0 - 0.15, 1.05, (STAIR.z0 + STAIR.z1) / 2]} rotation={[Math.PI / 2, 0, 0]} material={materials.steel}>
        <cylinderGeometry args={[0.025, 0.025, run, 8]} />
      </mesh>
    </group>
  )
}

/** A concrete street lamp: a square column and a deep arm. Leaning over the plaza, as in the photographs. */
function Lamp({ x, z, toward }: { x: number; z: number; toward: 1 | -1 }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[toward * 1.1, 13.05, 0]}>
        <boxGeometry args={[2.6, 0.3, 0.5]} />
        <meshStandardMaterial color="#b4b0a8" roughness={0.9} />
      </mesh>
      <mesh position={[toward * 2.1, 12.85, 0]}>
        <boxGeometry args={[0.7, 0.14, 0.34]} />
        <meshStandardMaterial color="#e9e6dc" emissive="#fff2cc" emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}

type FacadeMaterials = {
  glass: THREE.Material
  mullion: THREE.Material
  lamp: THREE.Material
  concrete: THREE.Material
  void: THREE.Material
  steel: THREE.Material
}

export function Facade({ materials }: { materials: FacadeMaterials }) {
  const decals = useMemo(() => ({
    logo: provinciaLogoTexture(),
    exit: exitSignTexture(),
    emblem: cafeEmblemTexture(),
    tactile: tactileTexture(),
    louvre: louvreTexture(),
  }), [])
  useEffect(() => () => Object.values(decals).forEach((texture) => texture.dispose()), [decals])
  return (
    <group>
      <Banners />
      {/* The mark on the volume over the doors. */}
      <Decal texture={decals.logo} position={[-7.6, 11.1, 3.215]} size={[5.6, 1.4]} />
      <Decal texture={decals.exit} position={[-3.6, MAR.soffit - 0.55, 0.12]} size={[0.9, 0.34]} basic />
      <Decal texture={decals.exit} position={[2.4, MAR.soffit - 0.55, 0.12]} size={[0.9, 0.34]} basic />
      {/* Café emblem on its glass, under the overhang. */}
      <Decal texture={decals.emblem} position={[-17.5, 1.9, 8.09]} size={[1.5, 1.6]} />
      {/* Louvres on the vent housing. */}
      <Decal texture={decals.louvre} position={[26.2, 0.62, 7.61]} size={[4.6, 0.9]} />
      {/* The orange tactile pad in the paving. */}
      <mesh position={[3.8, 0.035, 12.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.5, 1.1]} />
        <meshStandardMaterial map={decals.tactile} roughness={0.8} />
      </mesh>
      <RevolvingDoor materials={materials} />
      <Downlights materials={materials} />
      <StairWell materials={materials} />
      <Lamp x={-34} z={21} toward={1} />
      <Lamp x={37} z={19} toward={-1} />
    </group>
  )
}
