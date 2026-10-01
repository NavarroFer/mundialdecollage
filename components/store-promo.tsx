import { ArrowRight, PackageOpen } from 'lucide-react'
import { TrackedLink } from '@/components/track'
import type { FunnelEvent } from '@/lib/funnel'
import type { Messages } from '@/lib/i18n/messages'
import { cn } from '@/lib/utils'

// The store, offered where people are already warm: right after sending an
// obra (forArtist) and on every obra page. `event` says where the click came
// from (STORE_ENTRY_EVENTS in lib/funnel.ts).
export function StorePromo({ m, event, forArtist = false, className }: {
  m: Messages
  event: Extract<FunnelEvent, `store_click_${string}`>
  forArtist?: boolean
  className?: string
}) {
  const t = m.growth
  return (
    <TrackedLink
      href="/tienda"
      event={event}
      className={cn(
        'group flex items-center gap-4 rounded-2xl border-2 border-collage-blue/30 bg-collage-blue/5 p-5 text-left transition-colors hover:border-collage-blue hover:bg-collage-blue/10',
        className,
      )}
    >
      <PackageOpen className="size-10 shrink-0 text-collage-red" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold tracking-[0.16em] text-collage-red uppercase">
          {forArtist ? t.storeEyebrowArtist : t.storeEyebrow}
        </span>
        <span className="font-display mt-1 block text-xl tracking-tight text-ink uppercase">{t.storeTitle}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{t.storeBody}</span>
        <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-collage-blue underline-offset-4 group-hover:underline">
          {t.storeCta}
          <ArrowRight className="size-4" aria-hidden="true" />
        </span>
      </span>
    </TrackedLink>
  )
}
