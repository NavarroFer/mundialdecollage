'use client'

import { useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { SRGBColorSpace } from 'three'
import type { Artwork as ArtworkData } from '@/data/artworks'

// Modern museum framing: a slim dark frame + a white mat (passe-partout)
// between the frame and the image, instead of one thick flat border.
const MAT_MARGIN = 0.07
const FRAME_BORDER = 0.045
const FRAME_DEPTH = 0.035
const FRAME_COLOR = '#161513'
const MAT_COLOR = '#f7f5f0'

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

  const matWidth = renderWidth + MAT_MARGIN * 2
  const matHeight = renderHeight + MAT_MARGIN * 2
  const frameWidth = matWidth + FRAME_BORDER * 2
  const frameHeight = matHeight + FRAME_BORDER * 2

  return (
    <group position={data.position} rotation={data.rotation}>
      {/* Slim outer frame, sitting slightly proud of the wall */}
      <mesh position={[0, 0, FRAME_DEPTH / 2]}>
        <boxGeometry args={[frameWidth, frameHeight, FRAME_DEPTH]} />
        <meshStandardMaterial color={FRAME_COLOR} roughness={0.55} />
      </mesh>
      {/* Mat board between the frame and the image */}
      <mesh position={[0, 0, FRAME_DEPTH + 0.002]}>
        <planeGeometry args={[matWidth, matHeight]} />
        <meshStandardMaterial color={MAT_COLOR} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0, FRAME_DEPTH + 0.006]}>
        <planeGeometry args={[renderWidth, renderHeight]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  )
}
