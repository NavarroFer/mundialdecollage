'use client'

import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { aimAtWall, type WallFrame, type WallPiece, type WallPoint } from '@/lib/collage-wall'
import { imageSrc } from '@/lib/image-src'
import { useInteractionStore } from '../interaction/store'
import { galleryThemes, type GalleryTheme } from '../themes'
import { canvasFonts } from '../fonts'
import { currentAim, useWallStore } from './store'

// A kraft frame visitors paste photos on: the museum's collective collage on
// Room 1's end wall, or a Club gallery's board on legs by its way in. The
// photos go over each other in order, a plaque names it, and a pale ghost
// of a photo shows wherever the visitor is aiming. Everything is drawn in
// the frame's own space (x across, y up, z out of its face), placed and
// turned by the group around it.

const BORDER = 0.12
const BORDER_DEPTH = 0.09
const KRAFT = '#cdb38c'
// Each photo sits a hair in front of the board and draws over the ones
// pasted before it (no depth writes, ordered by renderOrder) — so they can
// overlap without flickering, like real paper.
const PIECE_LIFT = 0.006

const raycastPosition = new THREE.Vector3()
const raycastDirection = new THREE.Vector3()

/** Inside the Canvas: tracks where the crosshair meets the frame, for E and the ghost. */
export function WallAim() {
  const camera = useThree((state) => state.camera)
  useFrame(() => {
    const interaction = useInteractionStore.getState()
    const wall = useWallStore.getState()
    let point = null
    // An obra in sight takes E first.
    if (!interaction.targetId && !interaction.openId && !wall.placing) {
      camera.getWorldPosition(raycastPosition)
      camera.getWorldDirection(raycastDirection)
      point = aimAtWall(raycastPosition, raycastDirection, wall.frame)
    }
    currentAim.point = point
    wall.setAiming(point !== null)
  })
  return null
}

/** Where a spot of the frame sits in the frame's own space. */
const local = ({ x, y }: WallPoint, frame: WallFrame, lift: number): [number, number, number] =>
  [(x - 0.5) * frame.width, frame.bottom + y * frame.height, lift]

export function CollageWall({ theme, title, subtitle, cyrillic }: { theme: GalleryTheme; title: string; subtitle: string; cyrillic: boolean }) {
  const pieces = useWallStore((state) => state.pieces)
  const frame = useWallStore((state) => state.frame)
  const { center, yaw, width, bottom, height } = frame
  const centerY = bottom + height / 2
  const frameColor = galleryThemes[theme].frame.outer

  return (
    <group position={[center[0], 0, center[1]]} rotation={[0, yaw, 0]}>
      <mesh position={[0, centerY, -0.01]} receiveShadow>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color={KRAFT} roughness={0.95} />
      </mesh>
      {[
        { x: 0, y: bottom + height + BORDER / 2, size: [width + BORDER * 2, BORDER] },
        { x: 0, y: bottom - BORDER / 2, size: [width + BORDER * 2, BORDER] },
        { x: width / 2 + BORDER / 2, y: centerY, size: [BORDER, height] },
        { x: -width / 2 - BORDER / 2, y: centerY, size: [BORDER, height] },
      ].map(({ x, y, size }) => (
        <mesh key={`${x} ${y}`} position={[x, y, BORDER_DEPTH / 2 - 0.02]} castShadow>
          <boxGeometry args={[size[0], size[1], BORDER_DEPTH]} />
          <meshStandardMaterial color={frameColor} roughness={0.6} />
        </mesh>
      ))}
      {frame.freestanding && <Stand frame={frame} color={frameColor} />}
      {pieces.map((piece, index) => <Piece key={piece.id} piece={piece} order={index} frame={frame} />)}
      <Ghost frame={frame} />
      {frame.plaqueY !== undefined && <Plaque title={title} subtitle={subtitle} cyrillic={cyrillic} y={frame.plaqueY} width={Math.min(PLAQUE.width, width + BORDER * 2)} />}
    </group>
  )
}

// A board in the middle of a room: a backing behind the kraft and two legs.
function Stand({ frame, color }: { frame: WallFrame; color: string }) {
  const { width, bottom, height } = frame
  return (
    <group>
      <mesh position={[0, bottom + height / 2, -0.05]} castShadow receiveShadow>
        <boxGeometry args={[width + BORDER * 2, height + BORDER * 2, 0.05]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (width / 2 - 0.12), 0, -0.05]}>
          <mesh position={[0, bottom / 2, 0]} castShadow><boxGeometry args={[0.06, bottom, 0.06]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>
          <mesh position={[0, 0.02, 0]} castShadow><boxGeometry args={[0.08, 0.04, 0.5]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>
        </group>
      ))}
    </group>
  )
}

function Piece({ piece, order, frame }: { piece: WallPiece; order: number; frame: WallFrame }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    let alive = true
    let loaded: THREE.Texture | null = null
    new THREE.TextureLoader().load(imageSrc(piece.url, 640), (result) => {
      result.colorSpace = THREE.SRGBColorSpace
      loaded = result
      if (alive) setTexture(result)
      else result.dispose()
    })
    return () => {
      alive = false
      loaded?.dispose()
    }
  }, [piece.url])

  if (!texture) return null
  const image = texture.image as { width: number; height: number }
  const aspect = image.width / image.height
  const side = frame.piece
  const photoWidth = aspect >= 1 ? side : side * aspect
  const photoHeight = aspect >= 1 ? side / aspect : side
  // Still in review: only its author sees it, a little faded.
  const opacity = piece.pending ? 0.6 : 1
  // A cutout keeps its own outline, so it goes on without the white card.
  const seeThrough = piece.pending || piece.cutout

  return (
    <group position={local(piece, frame, PIECE_LIFT)} rotation={[0, 0, piece.rotation]}>
      {!piece.cutout && (
        <mesh renderOrder={10 + order * 2}>
          <planeGeometry args={[photoWidth + 0.04, photoHeight + 0.04]} />
          <meshStandardMaterial color="#fbfaf6" roughness={0.8} depthWrite={false} transparent={piece.pending} opacity={opacity} />
        </mesh>
      )}
      <mesh renderOrder={11 + order * 2} position={[0, 0, 0.001]}>
        <planeGeometry args={[photoWidth, photoHeight]} />
        <meshStandardMaterial map={texture} roughness={0.7} depthWrite={false} transparent={seeThrough} opacity={opacity} />
      </mesh>
    </group>
  )
}

function Ghost({ frame }: { frame: WallFrame }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const point = useWallStore.getState().placing ?? currentAim.point
    mesh.visible = point !== null
    if (point) mesh.position.set(...local(point, frame, PIECE_LIFT * 2))
  })
  return (
    <mesh ref={ref} renderOrder={100000} visible={false}>
      <planeGeometry args={[frame.piece, frame.piece]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.45} depthWrite={false} />
    </mesh>
  )
}

const PLAQUE = { width: 1.9, height: 0.3 }

function Plaque({ title, subtitle, cyrillic, y, width }: { title: string; subtitle: string; cyrillic: boolean; y: number; width: number }) {
  const material = useRef<THREE.MeshStandardMaterial>(null)

  useEffect(() => {
    let alive = true
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = Math.round(1024 * (PLAQUE.height / PLAQUE.width))
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    const fonts = canvasFonts(cyrillic)
    const draw = () => {
      const context = canvas.getContext('2d')
      if (!alive || !context) return
      context.fillStyle = '#faf8f2'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = '#1b110c'
      context.textAlign = 'center'
      context.font = `64px ${fonts.display}`
      context.fillText(title.toUpperCase(), canvas.width / 2, 82, canvas.width - 60)
      context.font = `600 34px ${fonts.body}`
      context.fillText(subtitle, canvas.width / 2, 132, canvas.width - 60)
      texture.needsUpdate = true
    }
    draw()
    if (material.current) {
      material.current.map = texture
      material.current.needsUpdate = true
    }
    // Redrawn once the brand fonts are in, in case they weren't yet.
    void Promise.all([document.fonts.load(`64px ${fonts.display}`, title), document.fonts.load(`600 34px ${fonts.body}`)]).then(draw, () => {})
    return () => {
      alive = false
      texture.dispose()
    }
  }, [title, subtitle, cyrillic])

  return (
    <mesh position={[0, y, 0.01]}>
      <planeGeometry args={[width, PLAQUE.height * (width / PLAQUE.width)]} />
      <meshStandardMaterial ref={material} color="#ffffff" roughness={0.6} />
    </mesh>
  )
}
