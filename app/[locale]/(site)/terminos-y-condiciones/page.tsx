import Link from 'next/link'
import { ArrowLeft, Download } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { Footer } from '@/components/footer'
import { TERMS_PDF_URL, TERMS_UPDATED_LABEL, termsIntro, termsSections } from '@/lib/terms'
import { getI18n } from '@/lib/i18n/server'
import { LegalLanguageNotice } from '@/components/legal-language-notice'

export const metadata = {
  title: 'Términos y Condiciones | Mundial de Collage',
  description:
    'Términos de uso del sitio, bases de la convocatoria, derechos sobre las obras, pagos y datos personales del Mundial Internacional de Collage.',
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-24">
      <h2 className="font-display text-xl tracking-tight text-ink uppercase sm:text-2xl">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
        {children}
      </div>
    </section>
  )
}

export default async function TerminosYCondicionesPage() {
  const { m } = await getI18n()
  return (
    <>
      <SiteHeader />
      <main lang="es" className="bg-background py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            {m.common.backHome}
          </Link>

          <LegalLanguageNotice />

          <h1 className="font-display mt-6 text-3xl leading-[1.05] tracking-tight text-ink uppercase sm:text-5xl">
            Términos y Condiciones
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Última actualización: {TERMS_UPDATED_LABEL}
          </p>

          <p className="mt-8 text-sm leading-relaxed text-foreground sm:text-base">{termsIntro}</p>

          <a
            href={TERMS_PDF_URL}
            download
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg border-2 border-ink px-4 text-sm font-semibold text-ink hover:bg-ink hover:text-paper"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Descargar bases y términos (PDF)
          </a>

          {termsSections.map((section, index) => (
            <Section key={section.id} id={section.id} title={`${index + 1}. ${section.title}`}>
              {section.blocks.map((block, blockIndex) =>
                typeof block === 'string' ? (
                  <p key={blockIndex}>{block}</p>
                ) : (
                  <ul key={blockIndex} className="list-disc space-y-1.5 pl-5">
                    {block.list.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ),
              )}
            </Section>
          ))}
        </div>
      </main>
      <Footer />
    </>
  )
}
