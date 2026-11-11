import type { Metadata } from 'next'
import { CommunityFeed } from '@/components/community/community-feed'
import { Footer } from '@/components/footer'
import { SiteHeader } from '@/components/site-header'
import { getCallState } from '@/lib/call-state'
import { getI18n } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n()
  return {
    title: `${m.community.title} · Mundial de Collage`,
    description: m.community.metaDescription,
  }
}

// The feed itself is fetched in the browser from /api/comunidad, so this
// page stays static (and so does its anon/ copy). Nothing here reads the
// session, cookies or searchParams.
export default async function ComunidadPage() {
  const { m } = await getI18n()
  const { open } = await getCallState()
  return (
    <>
      <SiteHeader />
      <main className="bg-grain py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <h1 className="font-display text-4xl tracking-tight text-ink uppercase sm:text-6xl">{m.community.title}</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">{m.community.metaDescription}</p>
          <div className="mt-10">
            <CommunityFeed callOpen={open} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
