import { RigidBody } from '@react-three/rapier'
import type { Artwork } from '@/data/artworks'
import { Artworks } from '../artwork/Artworks'
import { Architecture } from './Architecture'
import { Lighting } from './Lighting'
import { Rooms } from './Rooms'
import { galleryThemes, type GalleryTheme } from '../themes'
import { Visitors } from './Visitors'
import { RemoteVisitors } from './RemoteVisitors'
import type { GalleryVenue } from '../venue'
import { mainGalleryTemplate, type GalleryRoomTemplate } from './roomsData'
import { MarMuseum } from './mar/MarMuseum'

export function World({ artworks, theme, template = mainGalleryTemplate, venue = 'mundial' }: { artworks: Artwork[]; theme: GalleryTheme; template?: GalleryRoomTemplate; venue?: GalleryVenue }) {
  if (venue === 'mar') {
    return (
      <>
        <color attach="background" args={['#8ec8ea']} />
        <MarMuseum />
        <Artworks artworks={artworks} theme={theme} />
        <RemoteVisitors theme={theme} />
      </>
    )
  }
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
