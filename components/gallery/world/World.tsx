import { RigidBody } from '@react-three/rapier'
import type { Artwork } from '@/data/artworks'
import { Artworks } from '../artwork/Artworks'
import { Lighting } from './Lighting'
import { Rooms } from './Rooms'

export function World({ artworks }: { artworks: Artwork[] }) {
  return (
    <>
      <Lighting />
      <RigidBody type="fixed" colliders="trimesh">
        <Rooms />
      </RigidBody>
      <Artworks artworks={artworks} />
    </>
  )
}
