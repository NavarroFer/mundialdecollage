import { Suspense } from 'react'
import { SiteHeader } from '@/components/site-header'
import { ArtworkLoader } from '@/components/artwork-loader'
import { Skeleton } from '@/components/ui/skeleton'
import { getI18n } from '@/lib/i18n/server'

// Mirrors the artwork page layout so the obra drops into place once it arrives.
export default async function Loading() {
  const { m } = await getI18n()
  return (
    <>
      {/* The header waits on the auth check; hold its height so nothing jumps. */}
      <Suspense fallback={<div className="min-h-[4.75rem] border-b-2 border-ink/10 bg-paper/95 lg:min-h-[5.5rem]" />}>
        <SiteHeader />
      </Suspense>
      <main className="bg-background py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-5 sm:px-8">
          <p role="status" className="text-sm font-semibold text-muted-foreground">{m.artwork.loading}</p>

          <div className="relative mt-8 h-[60vh] overflow-hidden rounded-2xl border-2 border-ink/10">
            <ArtworkLoader />
          </div>

          <div className="mt-8">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-3 h-10 w-3/4 sm:h-12" />
            <Skeleton className="mt-6 h-6 w-48" />
            <Skeleton className="mt-2 h-4 w-24" />
          </div>
        </div>
      </main>
    </>
  )
}
