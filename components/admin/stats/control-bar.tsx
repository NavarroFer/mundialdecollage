'use client'

import { CalendarRange, ChevronsUpDown, Hash, Table2, Text } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LIMIT_OPTIONS, Segmented, ToolbarToggle } from './controls'
import { usePageView } from './view-settings'

// One row above everything it scopes: the period first (it re-renders the
// page on the server), then the view settings for every chart at once. A
// chart's own toolbar can still change its copy afterwards.
export function StatsControlBar({ periods, periodDays }: { periods: { days: number; href: string }[]; periodDays: number }) {
  const { settings, set } = usePageView()
  return (
    <div className="sticky top-0 z-30 -mx-5 mt-6 border-y-2 border-ink/10 bg-background/95 px-5 py-3 backdrop-blur-sm sm:-mx-8 sm:px-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Segmented label="Período de estadísticas" value={periodDays} options={periods.map(({ days, href }) => ({ value: days, label: `${days} días`, href }))} />
        <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-ink/15 sm:block" />
        <span className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground uppercase">Todos los gráficos</span>
        <Segmented label="Filas de los rankings" options={LIMIT_OPTIONS} value={settings.limit} onChange={(limit) => set('limit', limit)} />
        <ToolbarToggle icon={Hash} pressed={settings.values} onPressedChange={(on) => set('values', on)}>Valores</ToolbarToggle>
        <ToolbarToggle icon={CalendarRange} pressed={settings.compare} onPressedChange={(on) => set('compare', on)}>Comparación</ToolbarToggle>
        <ToolbarToggle icon={Table2} pressed={settings.table} onPressedChange={(on) => set('table', on)}>Tablas</ToolbarToggle>
        <ToolbarToggle icon={Text} pressed={settings.notes} onPressedChange={(on) => set('notes', on)}>Notas</ToolbarToggle>
        <ToolbarToggle icon={ChevronsUpDown} pressed={settings.open} onPressedChange={(on) => set('open', on)}>Abrir todos</ToolbarToggle>
      </div>
    </div>
  )
}

// The heading of a group of charts, in the same voice as the frames.
export function StatsSection({
  id,
  eyebrow,
  title,
  description,
  tone = 'blue',
  className,
  children,
}: {
  id: string
  eyebrow: string
  title: string
  description?: string
  tone?: 'blue' | 'red'
  className?: string
  children: React.ReactNode
}) {
  const { settings } = usePageView()
  return (
    <section aria-labelledby={id} className={cn('mt-14', className)}>
      <div className={cn('border-l-4 pl-4', tone === 'blue' ? 'border-collage-blue' : 'border-collage-red')}>
        <p className={cn('text-xs font-bold tracking-[0.18em] uppercase', tone === 'blue' ? 'text-collage-blue' : 'text-collage-red')}>{eyebrow}</p>
        <h2 id={id} className="font-display mt-1 text-3xl tracking-tight text-ink uppercase">{title}</h2>
        {settings.notes && description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="mt-6 space-y-6">{children}</div>
    </section>
  )
}
