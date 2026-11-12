import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { AppFrame } from '@/components/app-frame'
import { SHOW_MUSEO_MAR } from '@/components/site-sections'
import { getI18n } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n()
  return { title: m.siteSections.show, description: m.siteSections.showLead }
}

// The virtual gallery that is open right now: Collage World Cup's, and MAR
// once SHOW_MUSEO_MAR is on. `image` is a view of that walk; MAR has none until
// its capture is added (public/muestra/ + lib/brand-images.mjs).
const ROOMS = {
  mundial: { href: '/galeria-3d', image: '/muestra/galeria-3d.jpg' },
  mar: { href: '/museomar', image: null },
} as const

export default async function MuestraPage() {
  const { m } = await getI18n()
  const t = m.siteSections
  const room = SHOW_MUSEO_MAR
    ? { ...ROOMS.mar, label: t.mar, body: t.marBody }
    : { ...ROOMS.mundial, label: t.gallery, body: t.galleryBody }
  return (
    <AppFrame>
      <h1 className="font-display text-4xl tracking-tight text-ink uppercase sm:text-5xl">{t.show}</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">{t.showLead}</p>
      <Link href={room.href} className="group mt-10 block overflow-hidden rounded-3xl border-2 border-ink/10 bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue">
        <div className="relative aspect-[16/7] w-full bg-ink/10">
          {room.image && (
            <Image
              src={room.image}
              alt=""
              fill
              sizes="(min-width: 1152px) 1088px, 100vw"
              priority
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02] motion-reduce:transition-none"
            />
          )}
        </div>
        <div className="p-5 sm:p-6">
          <span className="font-display text-2xl tracking-tight text-ink uppercase sm:text-3xl">{room.label}</span>
          <span className="mt-2 block max-w-2xl text-sm text-muted-foreground sm:text-base">{room.body}</span>
        </div>
      </Link>
    </AppFrame>
  )
}
