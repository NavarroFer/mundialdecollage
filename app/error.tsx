'use client'

import { useEffect } from 'react'
import { RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n/client'
import { site } from '@/lib/site'

// Shown in place of a page that threw while rendering (a Supabase outage, a
// bug), instead of Next's bare error screen. Same look as app/not-found.tsx;
// the root layout — header strip, i18n — stays around it.
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { m } = useI18n()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="bg-grain relative overflow-hidden py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-24 -left-10 h-28 w-28 rounded-full bg-collage-red/90 sm:top-32 sm:left-[6%]" />
        <div className="absolute top-10 right-[8%] h-16 w-16 rounded-full bg-collage-yellow sm:top-16" />
      </div>

      <div className="relative mx-auto max-w-2xl px-5 text-center sm:px-8">
        <h1 className="font-display text-5xl leading-[0.95] tracking-tight text-ink uppercase sm:text-7xl">{m.common.errorTitle}</h1>
        <p className="mx-auto mt-7 max-w-md text-lg text-muted-foreground sm:text-xl">{m.common.errorBody}</p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button size="lg" className="gap-2" onClick={() => retry()}>
            <RotateCcw className="h-5 w-5" />
            {m.common.tryAgain}
          </Button>
          <Link href="/">
            <Button size="lg" variant="outline">{m.common.backHome}</Button>
          </Link>
          <a href={`mailto:${site.email}`} className="text-sm font-semibold underline">{site.email}</a>
        </div>
      </div>
    </main>
  )
}
