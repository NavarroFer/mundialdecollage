import { renderAsAnonymous } from '@/lib/render-mode'
import Galeria3DPage, { generateMetadata as pageMetadata } from '../../galeria-3d/page'

// The anonymous copy of /galeria-3d (lib/static-pages.ts): built per language,
// refreshed right away when the app changes its data or the exhibition cron
// rotates the day's lineup (lib/public-data-cache.ts). The hour is only a
// fallback for that rotation, as on the home: each rebuild is ISR writes.
export const revalidate = 3600

export function generateMetadata() {
  renderAsAnonymous()
  return pageMetadata()
}

export default function AnonymousGaleria3DPage() {
  renderAsAnonymous()
  return <Galeria3DPage />
}
