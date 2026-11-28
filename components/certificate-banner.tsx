import { ArrowRight, Award } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TrackedLink, TrackView } from '@/components/track'
import type { FunnelEvent } from '@/lib/funnel'
import type { Messages } from '@/lib/i18n/messages'
import { MY_CERTIFICATE_PATH } from '@/lib/my-certificate'

// «Tu certificado ya está listo»: what a participating artist sees first once
// the call has closed — on the home, above their obra, and where signing in
// lands them (/onboarding). Leads to /mi-certificado. The caller decides
// whether there is a certificate (lib/my-certificate.ts).
export function CertificateBanner({ m, event, className = '' }: { m: Messages; event: FunnelEvent; className?: string }) {
  const t = m.certificate
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-collage-blue p-6 text-paper sm:p-8 ${className}`}>
      <div aria-hidden="true" className="pointer-events-none absolute -right-8 -bottom-10 h-36 w-36 rounded-full bg-collage-yellow sm:h-44 sm:w-44" />
      <div aria-hidden="true" className="torn-strip pointer-events-none absolute -top-2 right-16 h-8 w-40 rotate-6 bg-collage-red sm:right-28" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
        <div className="flex h-16 w-16 shrink-0 -rotate-6 items-center justify-center rounded-sm bg-paper shadow-lg sm:h-20 sm:w-20">
          <Award className="h-9 w-9 text-collage-red sm:h-11 sm:w-11" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl tracking-tight uppercase sm:text-3xl">{t.homeTitle}</h2>
          <p className="mt-1.5 max-w-xl text-paper/85">{t.homeBody}</p>
        </div>
        <Button asChild size="lg" className="relative h-auto min-h-12 shrink-0 gap-2 bg-paper px-6 text-base text-ink hover:bg-paper/90">
          <TrackedLink href={MY_CERTIFICATE_PATH} event={event}>
            {t.homeCta}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </TrackedLink>
        </Button>
      </div>
      <TrackView event="certificate_banner_view" />
    </div>
  )
}
