import Link from 'next/link'
import { ArrowLeft, Download } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { Footer } from '@/components/footer'
import { site } from '@/lib/site'

export const metadata = {
  title: 'Términos y Condiciones | Mundial de Collage',
  description:
    'Términos de uso del sitio y bases generales de la convocatoria del Mundial Internacional de Collage.',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl tracking-tight text-ink uppercase sm:text-2xl">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
        {children}
      </div>
    </section>
  )
}

export default function TerminosYCondicionesPage() {
  return (
    <>
      <SiteHeader />
      <main className="bg-background py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Link>

          <h1 className="font-display mt-6 text-3xl leading-[1.05] tracking-tight text-ink uppercase sm:text-5xl">
            Términos y Condiciones
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Última actualización: septiembre de 2026
          </p>

          <p className="mt-8 text-sm leading-relaxed text-foreground sm:text-base">
            Estos términos rigen el uso de {site.name} (el &quot;Sitio&quot;), la
            inscripción de obras a la convocatoria y la inscripción al taller. Al usar
            el Sitio, aceptás estos términos.
          </p>

          <Section title="El servicio">
            <p>
              {site.shortName} es una convocatoria internacional de collage, gratuita y
              abierta a todo el mundo, que además ofrece un taller presencial en{' '}
              {site.workshop.locationLabel}. El Sitio permite enviar una obra a la
              convocatoria, iniciar sesión con Google, e inscribirse al taller.
            </p>
          </Section>

          <Section title="Bases de la convocatoria">
            <p>Resumen de las condiciones para participar con una obra:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Técnica: analógico, digital o mixto — una obra por persona.</li>
              <li>Costo: 100% libre y gratuito, abierto a todo el mundo.</li>
              <li>Fecha límite de envío: {site.deadlineLabel}.</li>
              <li>
                Envío: a{' '}
                <a
                  href={`mailto:${site.email}`}
                  className="text-ink underline underline-offset-4"
                >
                  {site.email}
                </a>
                , indicando nombre, país y título de la obra (o a través del formulario
                del Sitio).
              </li>
              <li>
                Jurado: selección a cargo de artistas y referentes del collage
                internacional. Los integrantes se anuncian antes del cierre de la
                convocatoria.
              </li>
              <li>
                Premios y reconocimiento: Gran Muestra Online Oficial para las obras
                seleccionadas, y publicación en la Revista 1ª Edición de Collage para las
                30 obras finalistas.
              </li>
            </ul>
            <p>
              Este resumen no reemplaza las bases completas. Ante cualquier diferencia,
              valen las{' '}
              <a
                href={site.basesPdfUrl}
                download
                className="inline-flex items-center gap-1 text-ink underline underline-offset-4"
              >
                bases oficiales en PDF
                <Download className="h-3.5 w-3.5" />
              </a>
              .
            </p>
          </Section>

          <Section title="Cuenta y elegibilidad">
            <p>
              Para enviar una obra o inscribirte al taller podés necesitar iniciar
              sesión con tu cuenta de Google. Sos responsable de que los datos que nos
              das sean correctos y de mantener tu cuenta segura.
            </p>
          </Section>

          <Section title="Propiedad intelectual">
            <p>
              Al enviar una obra, declarás que es de tu autoría y original, y que
              contás con los derechos necesarios para presentarla. Vos conservás todos
              los derechos sobre tu obra. Nos das un permiso no exclusivo para
              exhibirla, publicarla y difundirla — en el Sitio, en redes y en la edición
              impresa/editorial de finalistas — en el marco de esta convocatoria y sus
              futuras ediciones, siempre con tu crédito (nombre y país).
            </p>
          </Section>

          <Section title="Inscripción y pagos del taller">
            <p>
              La inscripción al taller puede requerir el pago de una seña o del total,
              procesado a través de Mercado Pago según las condiciones vigentes al
              momento de inscribirte (precio, cupo y fecha se muestran en el Sitio antes
              de confirmar el pago). El cupo del taller es limitado
              {site.workshop.capacity ? ` a ${site.workshop.capacity} personas` : ''}.
            </p>
          </Section>

          <Section title="Uso aceptable">
            <p>
              No está permitido enviar obras que no sean tuyas, que infrinjan derechos
              de terceros, ni usar el Sitio para fines distintos a los de esta
              convocatoria.
            </p>
          </Section>

          <Section title="Responsabilidad">
            <p>
              Hacemos lo posible por mantener el Sitio disponible y la convocatoria
              funcionando según lo publicado, pero no garantizamos que el servicio esté
              libre de errores o interrupciones. No nos responsabilizamos por
              inconvenientes ajenos a nuestro control, como fallas de terceros
              (Google, Mercado Pago) usados para operar el Sitio.
            </p>
          </Section>

          <Section title="Cambios a estos términos">
            <p>
              Podemos actualizar estos términos o las bases de la convocatoria. Si lo
              hacemos, vamos a actualizar la fecha al principio de esta página.
            </p>
          </Section>

          <Section title="Ley aplicable">
            <p>
              Estos términos se rigen por las leyes de Argentina. Ante cualquier
              consulta, escribinos a{' '}
              <a href={`mailto:${site.email}`} className="text-ink underline underline-offset-4">
                {site.email}
              </a>
              .
            </p>
          </Section>
        </div>
      </main>
      <Footer />
    </>
  )
}
