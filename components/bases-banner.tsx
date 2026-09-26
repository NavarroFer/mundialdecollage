import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FadeIn } from '@/components/fade-in'
import { TrackedAnchor } from '@/components/track'
import { site } from '@/lib/site'
import { getI18n } from '@/lib/i18n/server'

export async function BasesBanner() {
  const { m } = await getI18n()
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

          <TrackedAnchor href={site.basesPdfUrl} download event="bases_download" className="shrink-0">
            <Button size="lg" variant="default" className="gap-2 bg-collage-yellow text-ink hover:bg-collage-yellow/90">
              <Download className="h-5 w-5" />
              {m.bases.download}
            </Button>
          </TrackedAnchor>
        </div>
      </FadeIn>
    </section>
  )
}
