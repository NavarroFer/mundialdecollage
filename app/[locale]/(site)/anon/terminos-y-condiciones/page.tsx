import { renderAsAnonymous } from '@/lib/render-mode'
import TerminosYCondicionesPage, { metadata as pageMetadata } from '../../terminos-y-condiciones/page'

// The anonymous copy of /terminos-y-condiciones (lib/static-pages.ts): built per language,
// refreshed at most every hour or right away when the app changes its data
// (lib/public-data-cache.ts).
export const revalidate = 3600

export const metadata = pageMetadata

export default function AnonymousTerminosYCondicionesPage() {
  renderAsAnonymous()
  return <TerminosYCondicionesPage />
}
