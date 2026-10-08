import { ArrowRight, BookOpen, PackageOpen } from 'lucide-react'
import { TrackedLink } from '@/components/track'
import type { FunnelEvent } from '@/lib/funnel'
import type { Messages } from '@/lib/i18n/messages'
import { cn } from '@/lib/utils'

function PromoCard({ href, event, icon: Icon, eyebrow, title, body, cta, className }: {
  href: string
  event: FunnelEvent
  icon: typeof PackageOpen
  eyebrow: string
  title: string
  body: string
  cta: string
  className?: string
}) {
  return (
    <TrackedLink
      href={href}
      event={event}
      className={cn(
        'group flex items-center gap-4 rounded-2xl border-2 border-collage-blue/30 bg-collage-blue/5 p-5 text-left transition-colors hover:border-collage-blue hover:bg-collage-blue/10',
        className,
      )}
    >
      <Icon className="size-10 shrink-0 text-collage-red" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold tracking-[0.16em] text-collage-red uppercase">{eyebrow}</span>
        <span className="font-display mt-1 block text-xl tracking-tight text-ink uppercase">{title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{body}</span>
        <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-collage-blue underline-offset-4 group-hover:underline">
          {cta}
          <ArrowRight className="size-4" aria-hidden="true" />
        </span>
      </span>
    </TrackedLink>
  )
}

// The store, offered where people are already warm: right after sending an
// obra (forArtist) and on every obra page. `event` says where the click came
// from (STORE_ENTRY_EVENTS in lib/funnel.ts).
export function StorePromo({ m, event, forArtist = false, className }: {
  m: Pick<Messages, 'growth'>
  event: Extract<FunnelEvent, `store_click_${string}`>
  forArtist?: boolean
  className?: string
}) {
  const t = m.growth
  return (
    <PromoCard
      href="/tienda"
      event={event}
      icon={PackageOpen}
      eyebrow={forArtist ? t.storeEyebrowArtist : t.storeEyebrow}
      title={t.storeTitle}
      body={t.storeBody}
      cta={t.storeCta}
      className={className}
    />
  )
}

// The magazine's pre-sale (app/revista). To artists (forArtist) the pitch is
// that every participant is in its index; to anyone else, what it is.
// MAGAZINE_ENTRY_EVENTS in lib/funnel.ts.
export function MagazinePromo({ m, event, forArtist = true, className }: {
  m: Messages
  event: Extract<FunnelEvent, `magazine_click_${string}`>
  forArtist?: boolean
  className?: string
}) {
  const t = m.magazine
  return (
    <PromoCard
      href="/revista"
      event={event}
      icon={BookOpen}
      eyebrow={forArtist ? t.promoEyebrow : t.badge}
      title={t.promoTitle}
      body={forArtist ? t.promoBody : t.intro}
      cta={t.promoCta}
      className={className}
    />
  )
}
