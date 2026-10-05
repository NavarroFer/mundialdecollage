import { renderAsAnonymous } from '@/lib/render-mode'
import MagazinePage, { generateMetadata as pageMetadata } from '../../revista/page'

// The anonymous copy of /revista (lib/static-pages.ts): built per language,
// refreshed at most every hour or right away when the app changes its data
// (lib/public-data-cache.ts).
export const revalidate = 3600

export function generateMetadata() {
  renderAsAnonymous()
  return pageMetadata()
}

export default function AnonymousMagazinePage() {
  renderAsAnonymous()
  return <MagazinePage />
}
