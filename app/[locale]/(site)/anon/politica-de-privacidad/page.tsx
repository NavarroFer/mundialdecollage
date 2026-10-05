import { renderAsAnonymous } from '@/lib/render-mode'
import PoliticaDePrivacidadPage, { metadata as pageMetadata } from '../../politica-de-privacidad/page'

// The anonymous copy of /politica-de-privacidad (lib/static-pages.ts): built per language,
// refreshed at most every hour or right away when the app changes its data
// (lib/public-data-cache.ts).
export const revalidate = 3600

export const metadata = pageMetadata

export default function AnonymousPoliticaDePrivacidadPage() {
  renderAsAnonymous()
  return <PoliticaDePrivacidadPage />
}
