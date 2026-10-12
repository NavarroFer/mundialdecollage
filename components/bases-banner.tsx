import { ArrowRight, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FadeIn } from '@/components/fade-in'
import { TrackedAnchor, TrackedLink } from '@/components/track'
import { getCallState } from '@/lib/call-state'
import { site } from '@/lib/site'
import { getI18n } from '@/lib/i18n/server'

// More people downloaded the bases (17.5 % of home visits) than tapped the
// hero's «Enviá tu obra» (13.7 %): whoever reads them is ready to send, so
// sending is the primary action right here, the bases the secondary one.
export async function BasesBanner() {
  const [{ m }, { open }] = await Promise.all([getI18n(), getCallState()])
  return (
    <section className="bg-ink py-10">
      <FadeIn>
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-5 px-5 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] text-collage-yellow uppercase">
              {m.bases.eyebrow}
            </p>
            <p className="font-display mt-1 text-2xl tracking-tight text-paper uppercase sm:text-3xl">
              {m.bases.title}
            </p>
            {m.bases.pdfLanguage && <p className="mt-1 text-sm text-paper/70">{m.bases.pdfLanguage}</p>}
          </div>

          <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:flex-row">
            {open && (
              <Button asChild size="lg" variant="default" className="gap-2 bg-collage-yellow text-ink hover:bg-collage-yellow/90">
                <TrackedLink href="/onboarding" event="submit_click_bases">
                  {m.hero.submit}
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </TrackedLink>
              </Button>
            )}
            <Button asChild size="lg" variant="outline" className={open ? 'gap-2 border-paper/40 bg-transparent text-paper hover:bg-paper/10 hover:text-paper' : 'gap-2 bg-collage-yellow text-ink hover:bg-collage-yellow/90'}>
              <TrackedAnchor href={site.basesPdfUrl} download event="bases_download">
                <Download className="h-5 w-5" aria-hidden="true" />
                {m.bases.download}
              </TrackedAnchor>
            </Button>
          </div>
        </div>
      </FadeIn>
    </section>
  )
}
