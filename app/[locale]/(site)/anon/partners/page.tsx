import { renderAsAnonymous } from '@/lib/render-mode'
import PartnersPage, { generateMetadata as pageMetadata } from '../../partners/page'

// The anonymous copy of /partners (lib/static-pages.ts): built per language
// and refreshed right away when the app changes its data
// (lib/public-data-cache.ts). Nothing on it follows the clock, so the day
// is only a backstop: every rebuild is ISR writes, and a shorter one only
// made the same page again.
export const revalidate = 86400

export function generateMetadata() {
  renderAsAnonymous()
  return pageMetadata()
}

export default function AnonymousPartnersPage() {
  renderAsAnonymous()
  return <PartnersPage />
}
