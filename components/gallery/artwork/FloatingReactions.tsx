'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Artwork } from '@/data/artworks'
import type { ReactionEmoji } from '../presence/protocol'
import { REACTION_LIFETIME_MS, usePresenceStore, type LiveReaction } from '../presence/store'

const LIFETIME = REACTION_LIFETIME_MS / 1000 - 0.2
const RISE = 1.1
const SIZE = 0.34
// Far enough off the wall to float in front of the frame, not inside it.
const WALL_OFFSET = 0.4

// Emoji fonts aren't available to WebGL text, so each emoji is drawn once
// onto a canvas by the browser and reused as a sprite texture.
const textures = new Map<ReactionEmoji, THREE.CanvasTexture>()

function emojiTexture(emoji: ReactionEmoji) {
  let texture = textures.get(emoji)
  if (!texture) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const context = canvas.getContext('2d')!
    context.font = '100px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(emoji, 64, 72)
    texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    textures.set(emoji, texture)
  }
  return texture
}

function FloatingReaction({ reaction, artwork }: { reaction: LiveReaction; artwork: Artwork }) {
  const sprite = useRef<THREE.Sprite>(null)
  const age = useRef(0)
  const texture = useMemo(() => emojiTexture(reaction.emoji), [reaction.emoji])

  // An obra's front faces its local +Z; its local +X runs along the wall.
  const start = useMemo(() => {
    const rotationY = artwork.rotation[1]
    const along = reaction.offset * artwork.width * 0.8
    return new THREE.Vector3(
      artwork.position[0] + Math.sin(rotationY) * WALL_OFFSET + Math.cos(rotationY) * along,
      artwork.position[1] - artwork.height * 0.3,
      artwork.position[2] + Math.cos(rotationY) * WALL_OFFSET - Math.sin(rotationY) * along,
    )
  }, [artwork, reaction.offset])

  useFrame((_, delta) => {
    const current = sprite.current
    if (!current) return
    age.current += delta
    const progress = Math.min(age.current / LIFETIME, 1)
    current.position.set(start.x, start.y + progress * RISE, start.z)
    current.scale.setScalar(SIZE * Math.min(1, age.current * 6))
    const material = current.material as THREE.SpriteMaterial
    material.opacity = progress < 0.6 ? 1 : 1 - (progress - 0.6) / 0.4
  })

  return (
    <sprite ref={sprite} position={start} scale={0}>
      <spriteMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </sprite>
  )
}

export function FloatingReactions({ artworks }: { artworks: Artwork[] }) {
  const reactions = usePresenceStore((state) => state.reactions)
  const byId = useMemo(() => new Map(artworks.map((artwork) => [artwork.id, artwork])), [artworks])

  return (
    <group>
      {reactions.map((reaction) => {
        const artwork = byId.get(reaction.artworkId)
        return artwork ? <FloatingReaction key={reaction.id} reaction={reaction} artwork={artwork} /> : null
      })}
    </group>
  )
}
