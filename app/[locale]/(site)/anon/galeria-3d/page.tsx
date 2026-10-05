import { renderAsAnonymous } from '@/lib/render-mode'
import Galeria3DPage, { generateMetadata as pageMetadata } from '../../galeria-3d/page'

// The anonymous copy of /galeria-3d (lib/static-pages.ts): built per language,
// refreshed at most every 5 minutes or right away when the app changes its data
// (lib/public-data-cache.ts).
export const revalidate = 300

export function generateMetadata() {
  renderAsAnonymous()
  return pageMetadata()
}

export default function AnonymousGaleria3DPage() {
  renderAsAnonymous()
  return <Galeria3DPage />
}
