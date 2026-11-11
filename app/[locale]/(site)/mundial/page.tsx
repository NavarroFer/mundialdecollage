import type { Metadata } from 'next'
import Link from 'next/link'
import { AppFrame } from '@/components/app-frame'
import { getI18n } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n()
  return { title: m.siteSections.mundial, description: m.siteSections.mundialLead }
}

const linkClass = 'flex min-h-14 items-center rounded-2xl border-2 border-ink/10 bg-card px-4 text-base font-semibold text-ink hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue'

export default async function MundialPage() {
  const { m } = await getI18n()
  const t = m.siteSections
  const institution = [
    { href: '/?sitio=1#bases', label: t.bases },
    { href: '/?sitio=1#primera-edicion', label: t.edition },
    { href: '/?sitio=1#jurado', label: t.jury },
    { href: '/?sitio=1#nosotros', label: t.about },
    { href: '/?sitio=1#donar', label: t.donate },
    { href: '/?sitio=1#mapa', label: t.map },
    { href: '/partners', label: 'Partners' },
  ]
  const places = [
    { href: '/club', label: t.club },
    { href: '/tienda', label: t.shop },
    { href: '/revista', label: t.magazine },
  ]
  return (
    <AppFrame>
      <h1 className="font-display text-4xl tracking-tight text-ink uppercase sm:text-5xl">{t.mundial}</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">{t.mundialLead}</p>
      <section className="mt-10" aria-labelledby="institution-title">
        <h2 id="institution-title" className="text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase">{t.institution}</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {institution.map((item) => <li key={item.href}><Link href={item.href} className={linkClass}>{item.label}</Link></li>)}
        </ul>
      </section>
      <section className="mt-12 border-t-2 border-ink/10 pt-10" aria-labelledby="places-title">
        <h2 id="places-title" className="text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase">{t.places}</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {places.map((item) => <li key={item.href}><Link href={item.href} className={linkClass}>{item.label}</Link></li>)}
        </ul>
      </section>
    </AppFrame>
  )
}
