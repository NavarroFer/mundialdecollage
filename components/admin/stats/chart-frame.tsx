'use client'

import { CalendarRange, Camera, Hash, Table2 } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { fileSlug } from '@/lib/chart-math'
import { cn } from '@/lib/utils'
import { CaptureDialog } from './capture-dialog'
import { ChartViewContext, FigureBlock, type ChartFigure, type ChartView } from './chart-kit'
import { LIMIT_OPTIONS, Segmented, ToolbarButton, ToolbarToggle } from './controls'
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
  sortOptions?: { value: string; label: ReactNode }[]
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
  level = 2,
  scope = 'period',
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
  sortOptions?: { value: string; label: ReactNode }[]
  actions?: ReactNode
  level?: 2 | 3
  // What the capture's source line says: the page's period, or the site as it is now.
  scope?: 'period' | 'current'
  initial?: Partial<ViewSettings>
  className?: string
  children: ReactNode
}) {
  const chartSettings = useChartSettings(initial)
  const [settings, set] = chartSettings
  const [sort, setSort] = useState(sortOptions?.[0]?.value ?? null)
  const [capturing, setCapturing] = useState(false)
  const titleId = useId()
  const Heading = level === 2 ? 'h2' : 'h3'

  // A tile of the page's mosaic: a column, so when its row is taller than
  // it the chart's slot takes the extra height and the footnote stays at
  // the bottom edge.
  return (
    <section aria-labelledby={titleId} className={cn('flex flex-col overflow-hidden rounded-3xl border-2 border-ink/10 bg-card', className)}>
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 p-5 pb-0 sm:p-6 sm:pb-0">
        <div className="min-w-0 flex-1 basis-52">
          {eyebrow && <p className="text-xs font-bold tracking-[0.18em] text-collage-red uppercase">{eyebrow}</p>}
          <Heading id={titleId} className="font-display mt-1 text-2xl font-normal tracking-tight text-ink uppercase">{title}</Heading>
          {settings.notes && description && <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">{description}</p>}
        </div>
        {figure && <FigureBlock figure={figure} />}
      </header>

      <div className="flex flex-wrap items-center justify-end gap-2 px-5 pt-4 sm:px-6">
        <ChartToolbar controls={controls} settings={chartSettings} sortOptions={sortOptions} sort={sort} onSort={setSort} actions={actions}>
          <ToolbarButton icon={Camera} onClick={() => setCapturing(true)}>Captura</ToolbarButton>
        </ChartToolbar>
      </div>
      <div className="flex flex-1 flex-col px-5 pt-4 pb-5 sm:px-6 sm:pb-6">
        <ChartViewContext value={chartView(settings, controls, sort, 'card')}>{children}</ChartViewContext>
      </div>
      {settings.notes && footnote && <p className="border-t-2 border-ink/10 px-5 py-4 text-xs leading-relaxed text-muted-foreground sm:px-6">{footnote}</p>}

      {capturing && (
        <CaptureDialog
          open
          onOpenChange={setCapturing}
          title={title}
          eyebrow={eyebrow}
          description={description}
          footnote={footnote}
          figure={figure}
          scope={scope}
          fileName={`estadisticas-${fileSlug(title)}`}
          view={chartView(settings, controls, sort, 'slide')}
          onNotesChange={(notes) => set('notes', notes)}
          toolbar={<ChartToolbar tone="dark" controls={controls} settings={chartSettings} sortOptions={sortOptions} sort={sort} onSort={setSort} actions={actions} />}
        >
          {children}
        </CaptureDialog>
      )}
    </section>
  )
}
