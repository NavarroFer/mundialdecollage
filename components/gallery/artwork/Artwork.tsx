'use client'

import { useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { SRGBColorSpace } from 'three'
import type { Artwork as ArtworkData } from '@/data/artworks'

const FRAME_MARGIN = 0.08
const FRAME_DEPTH = 0.03
const FRAME_COLOR = '#2a211c'

function setSrgb(texture: { colorSpace: string }) {
  texture.colorSpace = SRGBColorSpace
}

export function Artwork({ data }: { data: ArtworkData }) {
  const texture = useTexture(data.image, setSrgb)

  // data.width/height is a bounding footprint on the wall — the image keeps
  // its native aspect ratio and is fit (never stretched) inside that box.
  const [renderWidth, renderHeight] = useMemo(() => {
    const image = texture.image as { width: number; height: number }
    const imageAspect = image.width / image.height
    const boxAspect = data.width / data.height
    return imageAspect > boxAspect
      ? [data.width, data.width / imageAspect]
      : [data.height * imageAspect, data.height]
  }, [texture, data.width, data.height])

  return (
    <group position={data.position} rotation={data.rotation}>
      <mesh position={[0, 0, -FRAME_DEPTH / 2]}>
        <boxGeometry args={[renderWidth + FRAME_MARGIN * 2, renderHeight + FRAME_MARGIN * 2, FRAME_DEPTH]} />
        <meshStandardMaterial color={FRAME_COLOR} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[renderWidth, renderHeight]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  )
}
