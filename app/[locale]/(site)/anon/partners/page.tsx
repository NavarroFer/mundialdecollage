import { renderAsAnonymous } from '@/lib/render-mode'
import PartnersPage, { generateMetadata as pageMetadata } from '../../partners/page'

// The anonymous copy of /partners (lib/static-pages.ts): built per language,
// refreshed at most every hour or right away when the app changes its data
// (lib/public-data-cache.ts).
export const revalidate = 3600

export function generateMetadata() {
  renderAsAnonymous()
  return pageMetadata()
}

export default function AnonymousPartnersPage() {
  renderAsAnonymous()
  return <PartnersPage />
}
