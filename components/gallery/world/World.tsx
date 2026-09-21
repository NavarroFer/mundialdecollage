import { RigidBody } from '@react-three/rapier'
import { Lighting } from './Lighting'
import { Rooms } from './Rooms'

export function World() {
  return (
    <>
      <Lighting />
      <RigidBody type="fixed" colliders="trimesh">
        <Rooms />
      </RigidBody>
    </>
  )
}
