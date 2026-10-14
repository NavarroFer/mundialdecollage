import { renderAsAnonymous } from '@/lib/render-mode'
import Home from '../page'

// The home for visitors with nothing personal (lib/static-pages.ts): built
// per language and refreshed right away when the app changes its data, or
// the exhibition cron rotates the day's lineup (lib/public-data-cache.ts).
// The hour is only a fallback for that rotation: everything else it reads is
// cached for a day, so rebuilding it every 5 minutes made the same page
// again, ~290 KB of ISR writes each time and almost half of all of them.
export const revalidate = 3600

export default function AnonymousHome() {
  renderAsAnonymous()
  return <Home searchParams={Promise.resolve({})} />
}
