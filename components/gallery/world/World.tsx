import { RigidBody } from '@react-three/rapier'
import type { Artwork } from '@/data/artworks'
import { Artworks } from '../artwork/Artworks'
import { Architecture } from './Architecture'
import { Lighting } from './Lighting'
import { Rooms } from './Rooms'
import { galleryThemes, type GalleryTheme } from '../themes'
import { Visitors } from './Visitors'
import { RemoteVisitors } from './RemoteVisitors'
import { mainGalleryTemplate, type GalleryRoomTemplate } from './roomsData'

export function World({ artworks, theme, template = mainGalleryTemplate }: { artworks: Artwork[]; theme: GalleryTheme; template?: GalleryRoomTemplate }) {
  return (
    <>
      <color attach="background" args={[galleryThemes[theme].canvas]} />
      <Lighting theme={theme} template={template} />
      <RigidBody type="fixed" colliders="trimesh">
        <Rooms theme={theme} template={template} />
      </RigidBody>
      <Architecture theme={theme} template={template} />
      <Artworks artworks={artworks} theme={theme} />
      <Visitors theme={theme} template={template} />
      <RemoteVisitors theme={theme} />
    </>
  )
}
