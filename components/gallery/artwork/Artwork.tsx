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
const LABEL_HEIGHT = 0.14
const LABEL_GAP = 0.08

function escapeSvgText(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function artistLabel(artist: string, countryCode: string) {
  const code = countryCode.toUpperCase()
  const flag = /^[A-Z]{2}$/.test(code)
    ? Array.from(code, (letter) => String.fromCodePoint(127397 + letter.charCodeAt(0))).join('')
    : ''
  const flagSpace = flag ? 62 : 0
  const textWidth = Array.from(artist).length * 19
  const width = Math.min(760, Math.max(320, textWidth + flagSpace + 48))
  const availableTextWidth = width - flagSpace - 48
  const fontSize = Math.min(32, 32 * availableTextWidth / Math.max(textWidth, 1))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="100" viewBox="0 0 ${width} 100">
    <rect x="1" y="1" width="${width - 2}" height="98" rx="6" fill="#f7f5f0" stroke="#d8d3ca" stroke-width="2"/>
    ${flag ? `<text x="24" y="53" dominant-baseline="middle" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif" font-size="38">${flag}</text>` : ''}
    <text x="${24 + flagSpace}" y="53" dominant-baseline="middle" fill="#161513" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="600">${escapeSvgText(artist)}</text>
  </svg>`

  return {
    url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    width: LABEL_HEIGHT * width / 100,
  }
}

function setSrgb(texture: { colorSpace: string }) {
  texture.colorSpace = SRGBColorSpace
}

export function Artwork({ data, theme }: { data: ArtworkData; theme: GalleryTheme }) {
  const texture = useTexture(data.image, setSrgb)
  const frame = galleryThemes[theme].frame
  const label = useMemo(() => artistLabel(data.artist, data.countryCode), [data.artist, data.countryCode])
  const labelTexture = useTexture(label.url, setSrgb)

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
        <planeGeometry args={[label.width, LABEL_HEIGHT]} />
        <meshBasicMaterial map={labelTexture} toneMapped={false} />
      </mesh>
    </group>
  )
}
