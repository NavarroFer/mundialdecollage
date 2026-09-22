import { RigidBody } from '@react-three/rapier'
import type { Artwork } from '@/data/artworks'
import { Artworks } from '../artwork/Artworks'
import { Lighting } from './Lighting'
import { Rooms } from './Rooms'
import { galleryThemes, type GalleryTheme } from '../themes'

export function World({ artworks, theme }: { artworks: Artwork[]; theme: GalleryTheme }) {
  return (
    <>
      <color attach="background" args={[galleryThemes[theme].canvas]} />
      {theme === 'ps2' && <fog attach="fog" args={['#02020d', 7, 35]} />}
      <Lighting theme={theme} />
      <RigidBody type="fixed" colliders="trimesh">
        <Rooms theme={theme} />
      </RigidBody>
      <Artworks artworks={artworks} theme={theme} />
    </>
  )
}
