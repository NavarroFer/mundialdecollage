import type { Metadata } from 'next'
import Link from 'next/link'
import { AppFrame } from '@/components/app-frame'
import { SHOW_MUSEO_MAR } from '@/components/site-sections'
import { getI18n } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n()
  return { title: m.siteSections.show, description: m.siteSections.showLead }
}

export default async function MuestraPage() {
  const { m } = await getI18n()
  const t = m.siteSections
  const rooms = [
    { href: '/galeria-3d', label: t.gallery, body: t.galleryBody },
    ...(SHOW_MUSEO_MAR ? [{ href: '/museomar', label: t.mar, body: t.marBody }] : []),
  ]
  return (
    <AppFrame>
      <h1 className="font-display text-4xl tracking-tight text-ink uppercase sm:text-5xl">{t.show}</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">{t.showLead}</p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {rooms.map((room) => (
          <li key={room.href}>
            <Link href={room.href} className="flex min-h-36 flex-col justify-end rounded-3xl border-2 border-ink/10 bg-card p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue">
              <span className="font-display text-2xl tracking-tight text-ink uppercase">{room.label}</span>
              <span className="mt-2 text-sm text-muted-foreground">{room.body}</span>
            </Link>
          </li>
        ))}
      </ul>
    </AppFrame>
  )
}
