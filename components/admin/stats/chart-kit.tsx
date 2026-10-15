'use client'

import { createContext, use, useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { DEFAULT_VIEW, type ViewSettings } from './view-settings'

// What a chart inside a ChartFrame is told: the settings that apply to it
// (a control the frame doesn't offer reads as off) and whether it sits in a
// page card or fills a capture slide.
export type ChartView = ViewSettings & { mode: 'card' | 'slide'; sort: string | null }

export const ChartViewContext = createContext<ChartView>({ ...DEFAULT_VIEW, compare: false, limit: null, mode: 'card', sort: null })

export function useChartView() {
  return use(ChartViewContext)
}

// The two series every chart draws with (app/globals.css explains the pick).
export const SERIES = { period: 'var(--color-chart-1)', recent: 'var(--color-chart-2)' } as const

// Layout size, not the on-screen one: a capture slide is scaled with a CSS
// transform, which ResizeObserver ignores, so charts draw at the slide's own
// size and the whole slide scales as one picture. A callback ref, so a node
// that comes and goes (the chart behind its table view) is measured again.
export function useElementSize<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize((current) => (current.width === width && current.height === height ? current : { width, height }))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])
  return [setNode, size] as const
}

// The key mirrors the mark: a bar swatch for bars, a short stroke for lines.
export function SeriesKey({ color, shape = 'bar' }: { color: string; shape?: 'bar' | 'line' }) {
  return shape === 'line'
    ? <i aria-hidden="true" className="inline-block h-0.5 w-3.5 shrink-0 rounded-full" style={{ background: color }} />
    : <i aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />
}

// One row above the marks: a key per series when there are two, and what the
// shares are measured against.
export function ChartLegend({ series, note }: { series?: { label: string; color: string; shape?: 'bar' | 'line' }[]; note?: string }) {
  if (!series?.length && !note) return null
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-semibold text-muted-foreground">
      {series?.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-ink"><SeriesKey color={item.color} shape={item.shape} />{item.label}</span>
      ))}
      {note && <span>{note}</span>}
    </div>
  )
}

export function EmptyChart({ children = 'Todavía no hay datos para graficar en este período.' }: { children?: string }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{children}</p>
}

export function ChartError({ children = 'No pudimos cargar estos datos. Recargá la página para reintentar.' }: { children?: string }) {
  return <p role="status" className="py-10 text-center text-sm text-collage-red">{children}</p>
}

// The headline number of a chart, top right of its frame and its slide. In
// a frame its label wraps at a narrow width, so a long one doesn't push the
// number under the title of a half-width tile.
export type ChartFigure = { value: string | number; label: string; details?: { label: ReactNode; series?: 'recent' }[] }

export function FigureBlock({ figure, large = false }: { figure: ChartFigure; large?: boolean }) {
  return (
    <span className={cn('block shrink-0 text-right', !large && 'max-w-44')}>
      <strong className={cn('font-display block leading-none tracking-tight text-ink', large ? 'text-6xl' : 'text-4xl')}>{figure.value}</strong>
      <span className="mt-1.5 block text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">{figure.label}</span>
      {figure.details?.length ? (
        <span className="mt-1.5 flex flex-wrap justify-end gap-x-3 gap-y-1 text-[11px] font-semibold text-muted-foreground">
          {figure.details.map((detail, index) => (
            <span key={index} className="inline-flex items-center gap-1">{detail.series === 'recent' && <SeriesKey color={SERIES.recent} />}{detail.label}</span>
          ))}
        </span>
      ) : null}
    </span>
  )
}
