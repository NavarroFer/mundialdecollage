'use client'

import { useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { SRGBColorSpace } from 'three'
import type { Artwork as ArtworkData } from '@/data/artworks'
import { galleryThemes, type GalleryTheme } from '../themes'

// Modern museum framing: a slim dark frame + a white mat (passe-partout)
// between the frame and the image, instead of one thick flat border.
const MAT_MARGIN = 0.07
const FRAME_BORDER = 0.045
const FRAME_DEPTH = 0.035
const LABEL_HEIGHT = 0.24
const LABEL_GAP = 0.12

function escapeSvgText(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function artistLabelDataUrl(artist: string) {
  const fontSize = Math.max(25, Math.min(44, 700 / Math.max(artist.length * 0.58, 1))) * 0.7
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="160" viewBox="0 0 800 160">
    <rect x="2" y="2" width="796" height="156" rx="8" fill="#f7f5f0" stroke="#d8d3ca" stroke-width="4"/>
    <text x="400" y="83" dominant-baseline="middle" text-anchor="middle" fill="#161513" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="600" letter-spacing="1">${escapeSvgText(artist)}</text>
  </svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function setSrgb(texture: { colorSpace: string }) {
  texture.colorSpace = SRGBColorSpace
}

export function Artwork({ data, theme }: { data: ArtworkData; theme: GalleryTheme }) {
  const texture = useTexture(data.image, setSrgb)
  const frame = galleryThemes[theme].frame
  const labelUrl = useMemo(() => artistLabelDataUrl(data.artist), [data.artist])
  const labelTexture = useTexture(labelUrl, setSrgb)

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
  const labelWidth = Math.min(1.5, Math.max(0.95, frameWidth * 0.78))
  const labelY = -frameHeight / 2 - LABEL_GAP - LABEL_HEIGHT / 2

  return (
    <group position={data.position} rotation={data.rotation}>
      {/* Slim outer frame, sitting slightly proud of the wall */}
      <mesh position={[0, 0, FRAME_DEPTH / 2]}>
        <boxGeometry args={[frameWidth, frameHeight, FRAME_DEPTH]} />
        <meshStandardMaterial color={frame.outer} roughness={frame.roughness} emissive={frame.emissive} emissiveIntensity={frame.emissive ? 0.55 : 0} />
      </mesh>
      {/* Mat board between the frame and the image */}
      <mesh position={[0, 0, FRAME_DEPTH + 0.002]}>
        <planeGeometry args={[matWidth, matHeight]} />
        <meshStandardMaterial color={frame.mat} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0, FRAME_DEPTH + 0.006]}>
        <planeGeometry args={[renderWidth, renderHeight]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {/* Museum-style label: always follows the frame and never covers the artwork. */}
      <mesh position={[0, labelY, FRAME_DEPTH + 0.006]}>
        <planeGeometry args={[labelWidth, LABEL_HEIGHT]} />
        <meshBasicMaterial map={labelTexture} toneMapped={false} />
      </mesh>
    </group>
  )
}
