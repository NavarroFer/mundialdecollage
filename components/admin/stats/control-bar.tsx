'use client'

import { CalendarRange, ChevronDown, Hash, Loader2, SlidersHorizontal, Table2, Text } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { LIMIT_OPTIONS, Segmented, ToolbarToggle } from './controls'
import { useStatsNavigation } from './navigation'
import { usePageView } from './view-settings'

// One row above everything it scopes: a «Filtros» button that opens the
// period and the browser (they re-render the page on the server) and the
// view settings for every chart at once, plus a line saying what's applied.
// A chart's own toolbar can still change its copy afterwards. While a
// filter loads, the row says so and a stripe runs along its bottom edge.
export function StatsControlBar({ periods, periodDays, browsers, browser }: {
  periods: { days: number; href: string }[]
  periodDays: number
  // Which app's browser the visits came from (lib/in-app-browser.ts); also in the URL.
  browsers: { value: string; label: string; href: string }[]
  browser: string
}) {
  const { settings, set } = usePageView()
  const navigation = useStatsNavigation()
  const pending = navigation?.pending ?? false
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // The summary follows the option being loaded, like the option itself.
  const shownDays = periods.find(({ href }) => href === navigation?.target)?.days ?? periodDays
  const shownBrowser = browsers.find(({ href }) => href === navigation?.target) ?? browsers.find(({ value }) => value === browser)
  const summary = [
    `Últimos ${shownDays} días`,
    shownBrowser?.value === 'todos' ? 'Todos los navegadores' : `Desde ${shownBrowser?.label}`,
    settings.limit === null ? 'Rankings completos' : `Top ${settings.limit}`,
  ]

  return (
    <div ref={rootRef} className="sticky top-0 z-30 -mx-5 mt-6 border-y-2 border-ink/10 bg-background/95 px-5 py-2.5 backdrop-blur-sm sm:-mx-8 sm:px-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
            open ? 'border-ink bg-ink text-paper' : 'border-ink/15 bg-card text-ink hover:border-ink/45',
          )}
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Filtros
          <ChevronDown className={cn('size-4 transition-transform duration-200 motion-reduce:transition-none', open && 'rotate-180')} aria-hidden="true" />
        </button>
        <p className="min-w-0 text-xs font-semibold text-muted-foreground">
          {summary.map((part, index) => (
            <span key={part}>{index > 0 && <span aria-hidden="true" className="mx-1.5 text-ink/25">·</span>}{part}</span>
          ))}
        </p>
        <p role="status" className="ml-auto flex items-center gap-1.5 text-xs font-bold text-collage-blue">
          {pending && <><Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />Actualizando datos…</>}
        </p>
      </div>

      {open && (
        <div
          id={panelId}
          role="group"
          aria-label="Filtros de las estadísticas"
          className="absolute top-full right-5 left-5 mt-2 space-y-5 rounded-3xl border-2 border-ink/10 bg-card p-4 shadow-xl transition-[opacity,translate] duration-200 starting:-translate-y-1.5 starting:opacity-0 motion-reduce:transition-none sm:right-auto sm:left-8 sm:w-[32rem] sm:p-5"
        >
          <FilterGroup title="Período" note="Vuelve a calcular todos los datos.">
            <Segmented label="Período de estadísticas" value={periodDays} options={periods.map(({ days, href }) => ({ value: days, label: `${days} días`, href }))} />
          </FilterGroup>
          <FilterGroup title="Navegador de las visitas" note="De qué app llegó la gente: Instagram, Facebook u otro navegador.">
            <Segmented label="Navegador de las visitas" value={browser} options={browsers} />
          </FilterGroup>
          <FilterGroup title="Todos los gráficos" note="Cada gráfico puede cambiarlo después en su propia barra.">
            <div className="flex flex-wrap items-center gap-2">
              <Segmented label="Filas de los rankings" options={LIMIT_OPTIONS} value={settings.limit} onChange={(limit) => set('limit', limit)} />
              <ToolbarToggle icon={Hash} pressed={settings.values} onPressedChange={(on) => set('values', on)}>Valores</ToolbarToggle>
              <ToolbarToggle icon={CalendarRange} pressed={settings.compare} onPressedChange={(on) => set('compare', on)}>Comparación</ToolbarToggle>
              <ToolbarToggle icon={Table2} pressed={settings.table} onPressedChange={(on) => set('table', on)}>Tablas</ToolbarToggle>
              <ToolbarToggle icon={Text} pressed={settings.notes} onPressedChange={(on) => set('notes', on)}>Notas</ToolbarToggle>
            </div>
          </FilterGroup>
        </div>
      )}

      <div aria-hidden="true" className={cn('pointer-events-none absolute inset-x-0 -bottom-0.5 h-0.5 overflow-hidden transition-opacity duration-300', pending ? 'opacity-100' : 'opacity-0')}>
        <span className="block h-full w-1/3 animate-progress-sweep bg-collage-blue motion-reduce:animate-none" />
      </div>
    </div>
  )
}

function FilterGroup({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground uppercase">{title}</p>
      <div className="mt-2">{children}</div>
      <p className="mt-1.5 text-xs text-muted-foreground">{note}</p>
    </div>
  )
}
