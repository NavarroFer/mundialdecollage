import type { Metadata } from 'next'
import { AppFrame } from '@/components/app-frame'
import { ExploreBrowser } from '@/components/explore-browser'
import { getI18n } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n()
  return { title: m.siteSections.explore, description: m.siteSections.exploreLead }
}

// No session: the list arrives from the CDN in the browser.
export default async function ExplorePage() {
  const { m } = await getI18n()
  const t = m.siteSections
  return (
    <AppFrame>
      <h1 className="font-display text-4xl tracking-tight text-ink uppercase sm:text-5xl">{t.explore}</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">{t.exploreLead}</p>
      <ExploreBrowser />
    </AppFrame>
  )
}
