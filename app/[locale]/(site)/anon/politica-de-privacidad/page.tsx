import { renderAsAnonymous } from '@/lib/render-mode'
import PoliticaDePrivacidadPage, { metadata as pageMetadata } from '../../politica-de-privacidad/page'

// The anonymous copy of /politica-de-privacidad (lib/static-pages.ts): built per language
// and refreshed right away when the app changes its data
// (lib/public-data-cache.ts). Nothing on it follows the clock, so the day
// is only a backstop: every rebuild is ISR writes, and a shorter one only
// made the same page again.
export const revalidate = 86400

export const metadata = pageMetadata

export default function AnonymousPoliticaDePrivacidadPage() {
  renderAsAnonymous()
  return <PoliticaDePrivacidadPage />
}
