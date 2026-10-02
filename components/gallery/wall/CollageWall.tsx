'use client'

import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { aimAtWall, WALL_FRAME, wallPointToWorld, type WallPiece } from '@/lib/collage-wall'
import { imageSrc } from '@/lib/image-src'
import { useInteractionStore } from '../interaction/store'
import { galleryThemes, type GalleryTheme } from '../themes'
import { canvasFonts } from '../fonts'
import { currentAim, useWallStore } from './store'

// The collective collage on Room 1's end wall: a big frame on kraft paper,
// the week's photos pasted over each other in order, a museum plaque under
// it, and a pale ghost of a photo wherever the visitor is aiming.

const BORDER = 0.12
const BORDER_DEPTH = 0.09
const KRAFT = '#cdb38c'
const FACING_ROOM: [number, number, number] = [0, Math.PI / 2, 0]
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
      point = aimAtWall(raycastPosition, raycastDirection)
    }
    currentAim.point = point
    wall.setAiming(point !== null)
  })
  return null
}

export function CollageWall({ theme, title, subtitle, cyrillic }: { theme: GalleryTheme; title: string; subtitle: string; cyrillic: boolean }) {
  const pieces = useWallStore((state) => state.pieces)
  const { faceX, centerZ, width, bottom, height } = WALL_FRAME
  const centerY = bottom + height / 2
  const frameColor = galleryThemes[theme].frame.outer

  return (
    <group>
      <mesh position={[faceX - 0.01, centerY, centerZ]} rotation={FACING_ROOM} receiveShadow>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color={KRAFT} roughness={0.95} />
      </mesh>
      {[
        { y: bottom + height + BORDER / 2, z: centerZ, size: [width + BORDER * 2, BORDER] },
        { y: bottom - BORDER / 2, z: centerZ, size: [width + BORDER * 2, BORDER] },
        { y: centerY, z: centerZ + width / 2 + BORDER / 2, size: [BORDER, height] },
        { y: centerY, z: centerZ - width / 2 - BORDER / 2, size: [BORDER, height] },
      ].map(({ y, z, size }) => (
        <mesh key={`${y} ${z}`} position={[faceX + BORDER_DEPTH / 2 - 0.02, y, z]} rotation={FACING_ROOM} castShadow>
          <boxGeometry args={[size[0], size[1], BORDER_DEPTH]} />
          <meshStandardMaterial color={frameColor} roughness={0.6} />
        </mesh>
      ))}
      {pieces.map((piece, index) => <Piece key={piece.id} piece={piece} order={index} />)}
      <Ghost />
      <Plaque title={title} subtitle={subtitle} cyrillic={cyrillic} />
    </group>
  )
}

function Piece({ piece, order }: { piece: WallPiece; order: number }) {
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
  const side = WALL_FRAME.piece
  const photoWidth = aspect >= 1 ? side : side * aspect
  const photoHeight = aspect >= 1 ? side / aspect : side
  const [x, y, z] = wallPointToWorld(piece)
  // Still in review: only its author sees it, a little faded.
  const opacity = piece.pending ? 0.6 : 1

  return (
    <group position={[x + PIECE_LIFT, y, z]} rotation={[0, Math.PI / 2, piece.rotation]}>
      <mesh renderOrder={10 + order * 2}>
        <planeGeometry args={[photoWidth + 0.04, photoHeight + 0.04]} />
        <meshStandardMaterial color="#fbfaf6" roughness={0.8} depthWrite={false} transparent={piece.pending} opacity={opacity} />
      </mesh>
      <mesh renderOrder={11 + order * 2} position={[0, 0, 0.001]}>
        <planeGeometry args={[photoWidth, photoHeight]} />
        <meshStandardMaterial map={texture} roughness={0.7} depthWrite={false} transparent={piece.pending} opacity={opacity} />
      </mesh>
    </group>
  )
}

function Ghost() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const point = useWallStore.getState().placing ?? currentAim.point
    mesh.visible = point !== null
    if (point) mesh.position.set(...wallPointToWorld(point)).setX(WALL_FRAME.faceX + PIECE_LIFT * 2)
  })
  return (
    <mesh ref={ref} rotation={FACING_ROOM} renderOrder={100000} visible={false}>
      <planeGeometry args={[WALL_FRAME.piece, WALL_FRAME.piece]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.45} depthWrite={false} />
    </mesh>
  )
}

const PLAQUE = { width: 1.9, height: 0.3, y: 0.52 }

function Plaque({ title, subtitle, cyrillic }: { title: string; subtitle: string; cyrillic: boolean }) {
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
    <mesh position={[WALL_FRAME.faceX + 0.01, PLAQUE.y, WALL_FRAME.centerZ]} rotation={FACING_ROOM}>
      <planeGeometry args={[PLAQUE.width, PLAQUE.height]} />
      <meshStandardMaterial ref={material} color="#ffffff" roughness={0.6} />
    </mesh>
  )
}
