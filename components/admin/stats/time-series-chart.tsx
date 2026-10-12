'use client'

import { useState, type KeyboardEvent, type PointerEvent } from 'react'
import { formatCount, highlightIndexes, niceTicks, valueLabelIndexes, xLabelIndexes } from '@/lib/chart-math'
import { EmptyChart, SERIES, useChartView, useElementSize } from './chart-kit'

type Point = { label: string; value: number }
type Unit = { one: string; other: string }

const CARD_HEIGHT = 240
const MARGIN = { top: 24, right: 16, bottom: 30, left: 44 }

const unitFor = (value: number, unit: Unit) => (value === 1 ? unit.one : unit.other)

// One series over time: a 2px line over a 10% wash, solid hairline grid,
// the peak and the last value labeled (every value with «Valores» on) and a
// crosshair that snaps to the nearest point, by pointer or arrow keys.
export function TimeSeriesChart({ data, unit, label }: { data: Point[]; unit: Unit; label: string }) {
  const view = useChartView()
  const [ref, size] = useElementSize<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  if (!data.length) return <EmptyChart />
  const slide = view.mode === 'slide'
  if (slide && view.table) return <SeriesTable data={data} unit={unit} label={label} />

  const width = size.width
  const height = slide ? size.height : CARD_HEIGHT
  const values = data.map((point) => point.value)
  const ticks = niceTicks(Math.max(...values))
  const top = ticks.at(-1) ?? 1
  const plotWidth = Math.max(width - MARGIN.left - MARGIN.right, 0)
  const plotHeight = Math.max(height - MARGIN.top - MARGIN.bottom, 0)
  const baseline = MARGIN.top + plotHeight
  const x = (index: number) => MARGIN.left + (data.length > 1 ? (index * plotWidth) / (data.length - 1) : plotWidth / 2)
  const y = (value: number) => baseline - (value / top) * plotHeight
  const spacing = data.length > 1 ? plotWidth / (data.length - 1) : plotWidth
  const line = data.map((point, index) => `${x(index)},${y(point.value)}`).join(' ')
  const area = `M ${x(0)},${baseline} L ${line} L ${x(data.length - 1)},${baseline} Z`
  const labeled = view.values ? valueLabelIndexes(data.length, plotWidth) : highlightIndexes(values)
  const anchor = (index: number) => (x(index) - MARGIN.left < 16 ? 'start' : width - MARGIN.right - x(index) < 16 ? 'end' : 'middle')

  const pick = (event: PointerEvent<SVGRectElement>) => {
    // The rect's on-screen box, so this holds inside a scaled capture slide.
    const box = event.currentTarget.getBoundingClientRect()
    const ratio = box.width ? (event.clientX - box.left) / box.width : 0
    setActive(Math.min(data.length - 1, Math.max(0, Math.round(ratio * (data.length - 1)))))
  }
  const step = (event: KeyboardEvent<SVGSVGElement>) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity }
    if (!(event.key in moves)) return
    event.preventDefault()
    setActive((current) => Math.min(data.length - 1, Math.max(0, (current ?? data.length - 1) + moves[event.key])))
  }
  const current = active === null ? null : data[active]

  return (
    <div>
      <div ref={ref} className="relative" style={slide ? { height: '100%', minHeight: CARD_HEIGHT } : { height: CARD_HEIGHT }}>
        {width > 0 && height > 0 && (
          <svg
            width={width}
            height={height}
            className="block overflow-visible outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
            role="img"
            aria-label={`${label}. Usá las flechas para recorrer los valores.`}
            tabIndex={0}
            onKeyDown={step}
            onFocus={() => setActive((current) => current ?? data.length - 1)}
            onBlur={() => setActive(null)}
          >
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? 'color-mix(in srgb, var(--color-ink) 28%, transparent)' : 'var(--color-border)'} strokeWidth="1" shapeRendering="crispEdges" />
                <text x={MARGIN.left - 10} y={y(tick)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="var(--color-muted-foreground)" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCount(tick)}</text>
              </g>
            ))}
            {xLabelIndexes(data.length, plotWidth).map((index) => (
              <text key={index} x={x(index)} y={baseline + 20} textAnchor={anchor(index)} fontSize="11" fontWeight="600" fill="var(--color-muted-foreground)">{data[index].label}</text>
            ))}
            <path d={area} fill={SERIES.period} opacity="0.1" />
            {data.length > 1 && <polyline points={line} fill="none" stroke={SERIES.period} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
            {current && active !== null && (
              <line x1={x(active)} x2={x(active)} y1={MARGIN.top - 8} y2={baseline} stroke="color-mix(in srgb, var(--color-ink) 35%, transparent)" strokeWidth="1" shapeRendering="crispEdges" />
            )}
            {data.map((point, index) => {
              const shown = index === active || spacing >= 16 || index === data.length - 1
              return shown ? <circle key={point.label} cx={x(index)} cy={y(point.value)} r={index === active ? 5 : 4} fill={SERIES.period} stroke="var(--chart-surface, var(--color-card))" strokeWidth="2" /> : null
            })}
            {labeled.map((index) => (
              <text key={index} x={x(index)} y={y(data[index].value) - 11} textAnchor={anchor(index)} fontSize="11" fontWeight="700" fill="var(--color-ink)" stroke="var(--chart-surface, var(--color-card))" strokeWidth="3" paintOrder="stroke" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatCount(data[index].value)}
              </text>
            ))}
            <rect x={MARGIN.left} y={MARGIN.top - 8} width={plotWidth} height={plotHeight + 8} fill="transparent" onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setActive(null)} />
          </svg>
        )}
        {current && active !== null && (
          <div
            className="pointer-events-none absolute z-10 w-max rounded-lg bg-ink px-3 py-2 text-paper shadow-lg"
            style={{ left: Math.min(Math.max(x(active) - 60, 0), Math.max(width - 128, 0)), top: Math.max(y(current.value) - 66, 0) }}
          >
            <strong className="block text-lg leading-none">{formatCount(current.value)} <span className="text-xs font-semibold text-paper/75">{unitFor(current.value, unit)}</span></strong>
            <span className="mt-1 block text-xs text-paper/75">{current.label}</span>
          </div>
        )}
        <p className="sr-only" aria-live="polite">{current ? `${current.label}: ${current.value} ${unitFor(current.value, unit)}` : ''}</p>
      </div>
      {view.table && <SeriesTable data={data} unit={unit} label={label} />}
    </div>
  )
}

// The table twin: every value, readable without hovering. On a slide it
// replaces the chart and flows into as many columns as it needs.
function SeriesTable({ data, unit, label }: { data: Point[]; unit: Unit; label: string }) {
  const { mode } = useChartView()
  const columns = data.length <= 12 ? 2 : data.length <= 36 ? 3 : data.length <= 60 ? 4 : 6
  const rows = Math.ceil(data.length / columns)
  return (
    <dl
      aria-label={`${label}: valores`}
      className={mode === 'slide'
        ? 'grid h-full auto-cols-fr grid-flow-col gap-x-6 gap-y-1 text-sm'
        : 'mt-5 grid max-h-56 grid-cols-2 gap-x-5 gap-y-1.5 overflow-y-auto rounded-xl bg-muted/60 p-3 text-xs sm:grid-cols-3 lg:grid-cols-4'}
      style={mode === 'slide' ? { gridTemplateRows: `repeat(${rows}, minmax(0, auto))` } : undefined}
    >
      {data.map((point) => (
        <div key={point.label} className="flex items-baseline justify-between gap-2 border-b border-ink/10 pb-1">
          <dt className="min-w-0 truncate text-muted-foreground">{point.label}</dt>
          <dd className="shrink-0 font-bold tabular-nums text-ink" title={`${point.value} ${unitFor(point.value, unit)}`}>{formatCount(point.value)}</dd>
        </div>
      ))}
    </dl>
  )
}
