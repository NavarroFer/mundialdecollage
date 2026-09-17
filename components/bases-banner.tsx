import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FadeIn } from '@/components/fade-in'
import { site } from '@/lib/site'

export function BasesBanner() {
  return (
    <section className="bg-ink py-10">
      <FadeIn>
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-5 px-5 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] text-collage-yellow uppercase">
              Antes de mandar tu obra
            </p>
            <p className="font-display mt-1 text-2xl tracking-tight text-paper uppercase sm:text-3xl">
              Leé las bases del Mundial
            </p>
          </div>

          <a href={site.basesPdfUrl} download className="shrink-0">
            <Button size="lg" variant="default" className="gap-2 bg-collage-yellow text-ink hover:bg-collage-yellow/90">
              <Download className="h-5 w-5" />
              Descargar PDF
            </Button>
          </a>
        </div>
      </FadeIn>
    </section>
  )
}
