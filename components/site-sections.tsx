import { SectionLink } from '@/components/section-link'
import { getI18n } from '@/lib/i18n/server'
import { cn } from '@/lib/utils'

// Turn on when the finalists are announced. Until then Museo MAR is linked
// only from the admin panel; /museomar itself keeps working.
export const SHOW_MUSEO_MAR = false

// How a logged-in artist moves through the rest of the site, and how the
// public home jumps to its own sections. Groups, not one long list.
export async function SiteSections({ here }: { here: 'feed' | 'site' }) {
  const { m } = await getI18n()
  const t = m.siteSections
  const site = (id: string) => `/?sitio=1#${id}`
  const groups = [
    {
      label: t.community,
      items: [{ href: '/', label: t.community, current: here === 'feed' }],
    },
    {
      label: t.show,
      items: [
        { href: '/galeria-3d', label: t.gallery, current: false },
        ...(SHOW_MUSEO_MAR ? [{ href: '/museomar', label: t.mar, current: false }] : []),
        { href: site('participantes'), label: t.participants, current: false },
        { href: site('mapa'), label: t.map, current: false },
        { href: site('jurado'), label: t.jury, current: false },
      ],
    },
    {
      label: t.mundial,
      items: [
        { href: site('bases'), label: t.bases, current: false },
        { href: site('primera-edicion'), label: t.edition, current: false },
        { href: site('nosotros'), label: t.about, current: false },
        { href: site('donar'), label: t.donate, current: false },
      ],
    },
    {
      label: t.clubShop,
      items: [
        { href: '/club', label: t.club, current: false },
        { href: '/tienda', label: t.shop, current: false },
        { href: '/revista', label: t.magazine, current: false },
      ],
    },
  ]

  return (
    <nav aria-label={t.label} className="border-b border-ink/10 bg-paper">
      <div className="mx-auto flex max-w-6xl gap-6 overflow-x-auto px-5 py-3 sm:px-8">
        {groups.map((group) => (
          <div key={group.label} className="shrink-0">
            <p className="text-[10px] font-bold tracking-[0.16em] text-muted-foreground uppercase">{group.label}</p>
            <ul className="mt-1 flex gap-1">
              {group.items.map((item) => (
                <li key={item.href}>
                  <SectionLink
                    href={item.href}
                    aria-current={item.current ? 'page' : undefined}
                    className={cn(
                      'inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold whitespace-nowrap',
                      item.current ? 'bg-ink text-paper' : 'text-ink/80 hover:bg-ink/5',
                    )}
                  >
                    {item.label}
                  </SectionLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}
