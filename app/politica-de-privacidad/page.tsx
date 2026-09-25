import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { Footer } from '@/components/footer'
import { site } from '@/lib/site'
import { getI18n } from '@/lib/i18n/server'
import { LegalLanguageNotice } from '@/components/legal-language-notice'

export const metadata = {
  title: 'Política de Privacidad | Mundial de Collage',
  description:
    'Cómo el Mundial Internacional de Collage recopila, usa y protege tus datos personales.',
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

export default async function PoliticaDePrivacidadPage() {
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
            Política de Privacidad
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Última actualización: septiembre de 2026
          </p>

          <p className="mt-8 text-sm leading-relaxed text-foreground sm:text-base">
            Esta política explica qué datos recopila {site.name} a través de{' '}
            {site.shortName} (el &quot;Sitio&quot;), para qué los usamos y qué derechos
            tenés sobre ellos. Al usar el Sitio — inscribir una obra, registrarte al
            taller o iniciar sesión con Google — aceptás las prácticas descritas acá.
          </p>

          <Section title="Quiénes somos">
            <p>
              {site.name} es una convocatoria internacional de collage organizada de
              forma independiente. Si tenés cualquier consulta sobre tus datos,
              escribinos a{' '}
              <a href={`mailto:${site.email}`} className="text-ink underline underline-offset-4">
                {site.email}
              </a>
              .
            </p>
          </Section>

          <Section title="Qué datos recopilamos">
            <p>Según cómo participes, podemos recopilar:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <span className="font-semibold text-foreground">Cuenta de Google:</span>{' '}
                si iniciás sesión con Google, recibimos tu nombre, dirección de email y
                foto de perfil públicas de tu cuenta. Usamos ese inicio de sesión solo
                para identificarte en el Sitio — no accedemos a tu Gmail, contactos ni
                a ningún otro dato de tu cuenta de Google.
              </li>
              <li>
                <span className="font-semibold text-foreground">Inscripción de obra:</span>{' '}
                nombre, país, título de la obra y la imagen que envíes.
              </li>
              <li>
                <span className="font-semibold text-foreground">Inscripción al taller:</span>{' '}
                nombre, email y los datos de pago necesarios para procesar tu inscripción.
              </li>
              <li>
                <span className="font-semibold text-foreground">Likes y comentarios en la galería:</span>{' '}
                para dar like o comentar ingresás con tu cuenta de Google. Guardamos tu
                email, las obras que te gustan y los comentarios que escribas. Los
                comentarios se publican con tu nombre después de que los revisamos; tu
                email nunca se muestra. Al dar like te sumamos a las novedades del
                Mundial por email; podés darte de baja cuando quieras. Los likes y
                comentarios que recibe una obra se le cuentan a su artista por email.
              </li>
              <li>
                <span className="font-semibold text-foreground">Uso del Sitio:</span>{' '}
                información técnica básica (como dirección IP y tipo de navegador) que
                se genera automáticamente al navegar.
              </li>
            </ul>
          </Section>

          <Section title="Para qué usamos tus datos">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Gestionar tu participación en la convocatoria y en el taller.</li>
              <li>Publicar las obras seleccionadas y sus créditos (nombre y país).</li>
              <li>Comunicarnos con vos sobre el estado de tu inscripción.</li>
              <li>
                Enviarte novedades del Mundial de Collage por email, cuando corresponda.
              </li>
              <li>Prevenir usos indebidos del Sitio.</li>
            </ul>
          </Section>

          <Section title="Con quién compartimos datos">
            <p>
              No vendemos tus datos. Los compartimos únicamente con los proveedores que
              usamos para operar el Sitio, y solo en la medida necesaria para el
              servicio que prestan:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <span className="font-semibold text-foreground">Google / Supabase</span>{' '}
                — autenticación e infraestructura de base de datos.
              </li>
              <li>
                <span className="font-semibold text-foreground">Mercado Pago</span> —
                procesamiento de pagos del taller. No almacenamos números de tarjeta ni
                otros datos financieros sensibles; Mercado Pago los procesa
                directamente.
              </li>
              <li>
                <span className="font-semibold text-foreground">Resend</span> — envío de
                emails y novedades.
              </li>
              <li>
                <span className="font-semibold text-foreground">Microsoft Clarity</span> —
                estadísticas de uso del Sitio (clics, desplazamiento y grabaciones
                anónimas de la navegación) para mejorarlo.
              </li>
            </ul>
          </Section>

          <Section title="Cuánto tiempo conservamos tus datos">
            <p>
              Conservamos tus datos mientras dure la convocatoria de la que participaste
              y el tiempo razonable necesario para exhibir los resultados de esa
              edición. Podés pedirnos que eliminemos tus datos antes en cualquier
              momento, salvo que necesitemos conservar algo por una obligación legal.
            </p>
          </Section>

          <Section title="Tus derechos">
            <p>
              Podés pedirnos acceder, corregir o eliminar tus datos personales cuando
              quieras, escribiendo a{' '}
              <a href={`mailto:${site.email}`} className="text-ink underline underline-offset-4">
                {site.email}
              </a>
              . Si estás en Argentina, estos derechos están reconocidos por la Ley
              25.326 de Protección de Datos Personales, y la Agencia de Acceso a la
              Información Pública es la autoridad de control.
            </p>
          </Section>

          <Section title="Cookies">
            <p>
              El Sitio usa cookies para mantener tu sesión iniciada y recordar el idioma
              que elegiste. También guarda un identificador anónimo al azar (sin tu
              nombre ni tu email) para contar cuántas personas recorren la galería y
              llegan a cada paso de la inscripción, y Microsoft Clarity usa sus propias
              cookies para las estadísticas de uso. No usamos cookies de seguimiento
              publicitario.
            </p>
          </Section>

          <Section title="Cambios a esta política">
            <p>
              Podemos actualizar esta política si cambia cómo tratamos tus datos. Si lo
              hacemos, vamos a actualizar la fecha al principio de esta página.
            </p>
          </Section>

          <Section title="Contacto">
            <p>
              Ante cualquier duda sobre esta política, escribinos a{' '}
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
