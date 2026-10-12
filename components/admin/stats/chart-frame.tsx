'use client'

import { CalendarRange, ChevronDown, Hash, Table2 } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ChartViewContext, FigureBlock, type ChartFigure, type ChartView } from './chart-kit'
import { LIMIT_OPTIONS, Segmented, ToolbarToggle } from './controls'
import { useChartSettings, type ViewSettings } from './view-settings'

// The one card every /admin/estadisticas chart sits in (a Template: the
// frame is fixed, the chart is the slot). Same heading, same figure, same
// toolbar in the same order, same footnote, so the page reads as one system
// and any chart can be swapped in without restyling it.
export type ChartControl = 'values' | 'compare' | 'table' | 'limit'
export type { ChartFigure }

type Tone = 'light' | 'dark'
type Settings = ReturnType<typeof useChartSettings>

// A control the frame doesn't offer reads as off for its chart.
function chartView(settings: ViewSettings, controls: ChartControl[], sort: string | null, mode: ChartView['mode']): ChartView {
  return {
    ...settings,
    values: controls.includes('values') && settings.values,
    compare: controls.includes('compare') && settings.compare,
    table: controls.includes('table') && settings.table,
    limit: controls.includes('limit') ? settings.limit : null,
    sort,
    mode,
  }
}

export function ChartToolbar({
  controls,
  settings: [settings, set],
  sortOptions,
  sort,
  onSort,
  actions,
  tone = 'light',
  children,
}: {
  controls: ChartControl[]
  settings: Settings
  sortOptions?: { value: string; label: string }[]
  sort: string | null
  onSort: (sort: string) => void
  actions?: ReactNode
  tone?: Tone
  children?: ReactNode
}) {
  return (
    <>
      {actions}
      {sortOptions && sort !== null && <Segmented label="Ordenar por" options={sortOptions} value={sort} onChange={onSort} tone={tone} />}
      {controls.includes('limit') && <Segmented label="Filas del ranking" options={LIMIT_OPTIONS} value={settings.limit} onChange={(limit) => set('limit', limit)} tone={tone} />}
      {controls.includes('values') && <ToolbarToggle icon={Hash} pressed={settings.values} onPressedChange={(on) => set('values', on)} tone={tone}>Valores</ToolbarToggle>}
      {controls.includes('compare') && <ToolbarToggle icon={CalendarRange} pressed={settings.compare} onPressedChange={(on) => set('compare', on)} tone={tone}>Comparación</ToolbarToggle>}
      {controls.includes('table') && <ToolbarToggle icon={Table2} pressed={settings.table} onPressedChange={(on) => set('table', on)} tone={tone}>Tabla</ToolbarToggle>}
      {children}
    </>
  )
}

export function ChartFrame({
  title,
  eyebrow,
  description,
  footnote,
  figure,
  controls = [],
  sortOptions,
  actions,
  collapsible = false,
  level = 2,
  initial,
  className,
  children,
}: {
  title: string
  eyebrow?: string
  description?: string
  footnote?: string
  figure?: ChartFigure
  controls?: ChartControl[]
  sortOptions?: { value: string; label: string }[]
  actions?: ReactNode
  collapsible?: boolean
  level?: 2 | 3
  initial?: Partial<ViewSettings>
  className?: string
  children: ReactNode
}) {
  const chartSettings = useChartSettings(initial)
  const [settings, set] = chartSettings
  const [sort, setSort] = useState(sortOptions?.[0]?.value ?? null)
  const titleId = useId()
  const bodyId = useId()
  const Heading = level === 2 ? 'h2' : 'h3'
  const open = !collapsible || settings.open

  // Inside the collapsible's button only phrasing content is allowed, so the
  // title is a span there and the heading wraps the button instead.
  const heading = (TitleTag: 'span' | 'h2' | 'h3') => (
    <>
      <span className="block min-w-0 flex-1 basis-72">
        {eyebrow && <span className="block text-xs font-bold tracking-[0.18em] text-collage-red uppercase">{eyebrow}</span>}
        <TitleTag id={titleId} className="font-display mt-1 block text-2xl font-normal tracking-tight text-ink uppercase">{title}</TitleTag>
        {settings.notes && description && <span className="mt-1.5 block max-w-3xl text-sm text-muted-foreground">{description}</span>}
      </span>
      {figure && <FigureBlock figure={figure} />}
    </>
  )

  return (
    <section aria-labelledby={titleId} className={cn('overflow-hidden rounded-3xl border-2 border-ink/10 bg-card', className)}>
      {collapsible ? (
        <Heading>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            aria-labelledby={titleId}
            onClick={() => set('open', !open)}
            className="flex w-full flex-wrap items-start justify-between gap-x-6 gap-y-3 p-5 text-left transition-colors hover:bg-collage-yellow/15 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-ink sm:p-6"
          >
            {heading('span')}
            <span className="flex items-center gap-2 self-center rounded-full bg-ink px-3 py-2 text-xs font-bold tracking-wide text-paper uppercase">
              <span className="hidden sm:inline">{open ? 'Cerrar' : 'Ver gráfico'}</span>
              <ChevronDown className={cn('size-4 transition-transform duration-300 motion-reduce:transition-none', open && 'rotate-180')} aria-hidden="true" />
            </span>
          </button>
        </Heading>
      ) : (
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 p-5 pb-0 sm:p-6 sm:pb-0">{heading(Heading)}</header>
      )}

      {open && (
        <div id={bodyId} className={cn(collapsible && 'border-t-2 border-ink/10')}>
          <div className="flex flex-wrap items-center justify-end gap-2 px-5 pt-4 sm:px-6">
            <ChartToolbar controls={controls} settings={chartSettings} sortOptions={sortOptions} sort={sort} onSort={setSort} actions={actions} />
          </div>
          <div className="px-5 pt-4 pb-5 sm:px-6 sm:pb-6">
            <ChartViewContext value={chartView(settings, controls, sort, 'card')}>{children}</ChartViewContext>
          </div>
          {settings.notes && footnote && <p className="border-t-2 border-ink/10 px-5 py-4 text-xs leading-relaxed text-muted-foreground sm:px-6">{footnote}</p>}
        </div>
      )}
    </section>
  )
}
