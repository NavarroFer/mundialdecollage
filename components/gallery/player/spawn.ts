import type { Artwork } from '@/data/artworks'

type Hanging = Pick<Artwork, 'position' | 'rotation' | 'width' | 'height'>

/** The body's centre height on the floor: its capsule's half height plus radius, plus a little air. */
export const SPAWN_HEIGHT = 0.9
// Where a visit starts with no obra on the walls: the middle of the hall,
// looking along -Z (yaw 0), with room to walk forward into the gallery.
export const HALL_SPAWN = { x: 0, z: -0.5, yaw: 0 }

/** How far in front of an obra to stand to take it in whole. */
export function viewingDistance({ width, height }: Pick<Artwork, 'width' | 'height'>) {
  return Math.max(width, height) * 0.62 + 0.75
}

/** The floor spot in front of an obra, and the camera's yaw that faces it. */
export function standInFront({ position, rotation, width, height }: Hanging) {
  const yaw = rotation[1]
  const distance = viewingDistance({ width, height })
  return { x: position[0] + Math.sin(yaw) * distance, z: position[2] + Math.cos(yaw) * distance, yaw }
}

/**
 * Where a visit starts: in front of an obra picked at random, facing it.
 * Everyone used to start in the hall facing the same wall, so that wall's
 * obra took most of the gallery's attention whatever hung there.
 */
export function pickSpawn(artworks: Hanging[], random = Math.random) {
  if (!artworks.length) return HALL_SPAWN
  const index = Math.min(artworks.length - 1, Math.floor(random() * artworks.length))
  return standInFront(artworks[index])
}
