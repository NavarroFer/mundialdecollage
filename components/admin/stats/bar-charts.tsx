'use client'

import type { ReactNode } from 'react'
import { formatShare } from '@/lib/artwork-stats'
import { cn } from '@/lib/utils'
import { barWidth, foldRows, formatCount, type ChartRow } from '@/lib/chart-math'
import { ChartLegend, EmptyChart, SERIES, SeriesKey, useChartView } from './chart-kit'

// The labels of the two windows a chart can compare (period and recent).
export type Windows = { period: string; recent: string }

// Bars grow in when they appear and slide to their new length when the data
// changes. Never on a capture slide, which has to be still when it's saved.
export function barMotion(slide: boolean, origin: 'left' | 'center') {
  return slide ? undefined : cn('transition-[width,scale] duration-500 ease-out starting:scale-x-0 motion-reduce:transition-none', origin === 'left' && 'origin-left')
}

// Shared by every bar chart: one legend row, keyed only when the recent
// window is drawn too.
function BarLegend({ windows, compare, note }: { windows?: Windows; compare: boolean; note?: string }) {
  const series = compare && windows ? [{ label: windows.period, color: SERIES.period }, { label: windows.recent, color: SERIES.recent }] : undefined
  return <ChartLegend series={series} note={note} />
}

function Values({ value, total, recent }: { value: number; total?: number; recent?: number }) {
  return (
    <span className="shrink-0 text-right text-sm tabular-nums">
      <b className="font-semibold text-ink">{formatCount(value)}</b>
      {total !== undefined && <span className="ml-1.5 text-muted-foreground">{formatShare(value, total)}</span>}
      {recent !== undefined && <span className="ml-2 inline-flex items-center gap-1 text-muted-foreground"><SeriesKey color={SERIES.recent} />{formatCount(recent)}</span>}
    </span>
  )
}

// A ranking: label and numbers on top, the bar below, growing from the left
// and scaled to the longest one in the list. With «Comparación» a thinner bar
// in the recent window's color sits right under it, on the same scale.
// Rows past the frame's limit fold into «Otros». A row's `icon` (a flag)
// goes before its label.
export function BarList({
  rows,
  total,
  label,
  note,
  windows,
}: {
  rows: (ChartRow & { icon?: ReactNode })[]
  total?: number
  label: string
  note?: string
  windows?: Windows
}) {
  const view = useChartView()
  if (!rows.length) return <EmptyChart />
  const shown = foldRows(rows, view.limit).rows
  const compare = view.compare && shown.some((row) => row.recent !== undefined)
  const max = Math.max(...shown.map((row) => row.value), 1)
  // On a slide each row is one line (label, bar, numbers) so a whole
  // ranking fits; in a card the label sits over a full-width bar.
  const slide = view.mode === 'slide'
  const dense = slide && shown.length > 8
  return (
    <div>
      <BarLegend windows={windows} compare={compare} note={note} />
      <ol aria-label={label} className={slide ? dense ? 'space-y-1.5' : 'space-y-2.5' : 'space-y-4'}>
        {shown.map((row, index) => {
          const bars = (
            <div className={cn('flex flex-col gap-[2px]', !slide && 'mt-1.5')} aria-hidden="true">
              <div className={cn('h-3 rounded-r-[4px]', barMotion(slide, 'left'))} style={{ width: `${barWidth(row.value, max)}%`, background: SERIES.period }} />
              {compare && <div className={cn('h-1.5 rounded-r-[3px]', barMotion(slide, 'left'))} style={{ width: `${barWidth(row.recent ?? 0, max)}%`, background: SERIES.recent }} />}
            </div>
          )
          const values = <Values value={row.value} total={total} recent={compare ? row.recent : undefined} />
          return (
            <li key={`${index}-${row.label}`} className={slide ? 'grid grid-cols-[minmax(0,26rem)_minmax(0,1fr)_auto] items-center gap-x-5' : undefined}>
              {slide ? (
                <>
                  <span className={cn('flex items-center gap-2 font-medium leading-snug text-ink', dense ? 'text-[13px]' : 'text-sm')}>{'icon' in row && row.icon}{row.label}</span>
                  {bars}
                  {values}
                </>
              ) : (
                <>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-medium leading-snug text-ink">{'icon' in row && row.icon}{row.label}</span>
                    {values}
                  </div>
                  {bars}
                </>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// A funnel: numbered steps in order, each bar centered so the list narrows
// like a funnel. Widths follow the busiest step (some routes have side steps
// that aren't strictly sequential); shares are over `base`.
export function FunnelChart({ steps, base, label, note, windows }: { steps: ChartRow[]; base?: number; label: string; note?: string; windows?: Windows }) {
  const view = useChartView()
  if (!steps.length) return <EmptyChart />
  const compare = view.compare && steps.some((step) => step.recent !== undefined)
  const max = Math.max(...steps.map((step) => step.value), 1)
  const slide = view.mode === 'slide'
  return (
    <div>
      <BarLegend windows={windows} compare={compare} note={note} />
      <ol aria-label={label} className={slide ? 'space-y-3' : 'space-y-4'}>
        {steps.map((step, index) => (
          <li
            key={step.label}
            className={slide
              ? 'grid grid-cols-[1.75rem_minmax(0,15rem)_minmax(0,1fr)_auto] items-center gap-x-4'
              : 'grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1.5'}
          >
            <span className={cn('font-display flex h-7 w-7 items-center justify-center rounded-full bg-collage-yellow text-sm text-ink', !slide && 'row-span-2 self-start')}>{String(index + 1).padStart(2, '0')}</span>
            <span className="min-w-0 text-sm font-semibold leading-snug text-ink">{step.label}</span>
            {!slide && <Values value={step.value} total={base} recent={compare ? step.recent : undefined} />}
            <div className={cn('flex flex-col items-center gap-[2px]', !slide && 'col-span-2')} aria-hidden="true">
              <div className={cn('h-6 rounded-[4px]', barMotion(slide, 'center'))} style={{ width: `${barWidth(step.value, max)}%`, background: SERIES.period }} />
              {compare && <div className={cn('h-1.5 rounded-[3px]', barMotion(slide, 'center'))} style={{ width: `${barWidth(step.recent ?? 0, max)}%`, background: SERIES.recent }} />}
            </div>
            {slide && <Values value={step.value} total={base} recent={compare ? step.recent : undefined} />}
          </li>
        ))}
      </ol>
    </div>
  )
}

// A part of a whole that has a 100%: the share as the headline, a meter
// whose track is a light step of the fill's own hue, and what's left as a
// status chip. In a tile stretched by its row it sits at the bottom edge.
export function Meter({ value, total, label, remainder }: { value: number; total: number; label: string; remainder: { label: string; done: string } }) {
  const { mode } = useChartView()
  const left = total - value
  return (
    <div className="mt-auto">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <strong className="font-display block text-5xl leading-none tracking-tight text-ink">{formatShare(value, total)}</strong>
          <span className="mt-2 block text-sm font-semibold text-ink">{label}</span>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-bold text-paper ${left === 0 ? 'bg-chart-1' : 'bg-collage-red'}`}>
          {left === 0 ? remainder.done : `${formatCount(left)} ${remainder.label}`}
        </span>
      </div>
      <div className="mt-5 h-3 overflow-hidden rounded-[4px]" style={{ background: 'color-mix(in oklab, var(--color-chart-1) 16%, var(--chart-surface, var(--color-card)))' }} role="meter" aria-valuemin={0} aria-valuemax={total} aria-valuenow={value} aria-label={label}>
        <div className={cn('h-full rounded-[4px]', barMotion(mode === 'slide', 'left'))} style={{ width: `${barWidth(value, total, 0)}%`, background: SERIES.period }} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{formatCount(value)} de {formatCount(total)} obras.</p>
    </div>
  )
}
