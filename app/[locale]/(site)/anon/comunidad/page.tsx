import { renderAsAnonymous } from '@/lib/render-mode'
import ComunidadPage, { generateMetadata as pageMetadata } from '../../comunidad/page'

// The anonymous copy of /comunidad (lib/static-pages.ts): built per language.
// The feed is loaded in the browser, so this page has nothing of its own to
// refresh more often than once a day.
export const revalidate = 86400

export function generateMetadata() {
  renderAsAnonymous()
  return pageMetadata()
}

export default function AnonymousComunidadPage() {
  renderAsAnonymous()
  return <ComunidadPage />
}
