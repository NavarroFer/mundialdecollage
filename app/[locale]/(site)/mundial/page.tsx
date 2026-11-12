import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight, Album, Map, Newspaper, Paperclip, Scissors, ScrollText, Stamp, StickyNote, Tag, Ticket } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AppFrame } from '@/components/app-frame'
import { getI18n } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n()
  return { title: m.siteSections.mundial, description: m.siteSections.mundialLead }
}

/**
 * Importance is carried by size first and colour second: the edition is the
 * largest block, the proof of scale (jury, map) comes next, the rest of the
 * institution is medium, and the secondary offers (club, shop, magazine, partners) stay
 * in a quieter band underneath, as PRODUCT.md asks.
 */
type Tile = {
  href: string
  label: string
  icon: LucideIcon
  /** Grid footprint at each breakpoint. */
  span: string
  /** Surface colours; text colours are picked together with the fill for contrast. */
  tone: string
  /** Label size follows the tile's rank. */
  size: string
}

const tileBase = 'group relative flex h-full min-h-28 flex-col justify-between overflow-hidden rounded-3xl p-5 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-collage-blue motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out motion-safe:hover:-translate-y-1 sm:p-6'

function MosaicTile({ tile }: { tile: Tile }) {
  const Icon = tile.icon
  return (
    <li className={tile.span}>
      <Link href={tile.href} className={`${tileBase} ${tile.tone}`}>
        <Icon aria-hidden className="pointer-events-none absolute -right-4 -bottom-4 size-32 opacity-[0.14] sm:size-40" strokeWidth={1.25} />
        <Icon aria-hidden className="size-6 sm:size-7" strokeWidth={2} />
        <span className="mt-4 flex items-end justify-between gap-3">
          <span className={`font-display leading-[0.95] tracking-tight uppercase text-balance ${tile.size}`}>{tile.label}</span>
          <ArrowUpRight aria-hidden className="size-5 shrink-0 motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:translate-x-1 motion-safe:group-hover:-translate-y-1" strokeWidth={2.5} />
        </span>
      </Link>
    </li>
  )
}

export default async function MundialPage() {
  const { m } = await getI18n()
  const t = m.siteSections
  const institution: Tile[] = [
    { href: '/?sitio=1#primera-edicion', label: t.edition, icon: Scissors, span: 'col-span-2 row-span-2 lg:col-span-4', tone: 'bg-collage-blue text-paper', size: 'text-4xl sm:text-6xl' },
    { href: '/?sitio=1#jurado', label: t.jury, icon: Stamp, span: 'col-span-1 lg:col-span-2', tone: 'bg-collage-red text-paper', size: 'text-2xl sm:text-3xl' },
    { href: '/?sitio=1#mapa', label: t.map, icon: Map, span: 'col-span-1 lg:col-span-2', tone: 'bg-collage-yellow text-ink', size: 'text-2xl sm:text-3xl' },
    { href: '/?sitio=1#bases', label: t.bases, icon: ScrollText, span: 'col-span-1 lg:col-span-2', tone: 'bg-ink text-paper', size: 'text-xl sm:text-2xl' },
    { href: '/?sitio=1#nosotros', label: t.about, icon: StickyNote, span: 'col-span-1 lg:col-span-2', tone: 'bg-collage-blue/15 text-ink', size: 'text-xl sm:text-2xl' },
    { href: '/?sitio=1#donar', label: t.donate, icon: Ticket, span: 'col-span-2 lg:col-span-2', tone: 'bg-collage-red/15 text-ink', size: 'text-xl sm:text-2xl' },
  ]
  const quiet = 'border-2 border-ink/15 bg-card text-ink hover:bg-ink/5'
  const places: Tile[] = [
    { href: '/club', label: t.club, icon: Album, span: 'col-span-1', tone: quiet, size: 'text-lg sm:text-xl' },
    { href: '/tienda', label: t.shop, icon: Tag, span: 'col-span-1', tone: quiet, size: 'text-lg sm:text-xl' },
    { href: '/revista', label: t.magazine, icon: Newspaper, span: 'col-span-1', tone: quiet, size: 'text-lg sm:text-xl' },
    { href: '/partners', label: 'Partners', icon: Paperclip, span: 'col-span-1', tone: quiet, size: 'text-lg sm:text-xl' },
  ]
  return (
    <AppFrame>
      <h1 className="font-display text-4xl tracking-tight text-ink uppercase sm:text-5xl">{t.mundial}</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">{t.mundialLead}</p>
      <section className="mt-8" aria-labelledby="institution-title">
        <h2 id="institution-title" className="sr-only">{t.institution}</h2>
        <ul className="grid auto-rows-[8.5rem] grid-cols-2 gap-3 sm:auto-rows-[10rem] lg:grid-cols-6 lg:gap-4">
          {institution.map((tile) => <MosaicTile key={tile.href} tile={tile} />)}
        </ul>
      </section>
      <section className="mt-12" aria-labelledby="places-title">
        <h2 id="places-title" className="text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase">{t.places}</h2>
        <ul className="mt-4 grid auto-rows-[6.5rem] grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {places.map((tile) => <MosaicTile key={tile.href} tile={tile} />)}
        </ul>
      </section>
    </AppFrame>
  )
}
