import { renderAsAnonymous } from '@/lib/render-mode'
import Home from '../page'

// The home for visitors with nothing personal (lib/static-pages.ts): built
// per language and refreshed at most every 5 minutes, or right away when the
// app changes its data (lib/public-data-cache.ts).
export const revalidate = 300

export default function AnonymousHome() {
  renderAsAnonymous()
  return <Home searchParams={Promise.resolve({})} />
}
