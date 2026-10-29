import { renderAsAnonymous } from '@/lib/render-mode'
import ClubPage, { generateMetadata as pageMetadata } from '../../club/page'

// The anonymous copy of /club (lib/static-pages.ts): built per language and
// served from the CDN. Nothing on it follows the clock, so the day is only a
// backstop: every rebuild is ISR writes.
export const revalidate = 86400

export function generateMetadata() {
  renderAsAnonymous()
  return pageMetadata()
}

export default function AnonymousClubPage() {
  renderAsAnonymous()
  return <ClubPage />
}
