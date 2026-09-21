import { RigidBody } from '@react-three/rapier'
import { Artworks } from '../artwork/Artworks'
import { Lighting } from './Lighting'
import { Rooms } from './Rooms'

export function World() {
  return (
    <>
      <Lighting />
      <RigidBody type="fixed" colliders="trimesh">
        <Rooms />
      </RigidBody>
      <Artworks />
    </>
  )
}
