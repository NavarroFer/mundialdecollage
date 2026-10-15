'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ImageOff } from 'lucide-react'
import { Fragment } from 'react'
import { barWidth, durationParts, formatCount, formatDuration, type DurationPart } from '@/lib/chart-math'
import { cn } from '@/lib/utils'
import { barMotion } from './bar-charts'
import { SERIES, useChartView } from './chart-kit'

export type AttentionRow = {
  slug: string
  title: string | null
  viewers: number
  view_seconds: number
  details_seconds: number
  observations: number
  average_view_seconds: number
  // From the obra itself (gallery-attention-stats.tsx), not the summary.
  image_url?: string | null
  artist?: string | null
}
type Metric = 'viewers' | 'view_seconds' | 'details_seconds' | 'average_view_seconds'

// `label` goes under the headline number; `short` names the metric in the
// line of the other three.
const METRICS: Record<Metric, { label: string; short: (value: number) => string; parts: (value: number) => DurationPart[] }> = {
  view_seconds: { label: 'de observación 3D', short: (value) => `${formatDuration(value)} en 3D`, parts: durationParts },
  viewers: { label: 'personas', short: (value) => `${formatCount(value)} ${value === 1 ? 'persona' : 'personas'}`, parts: (value) => [{ value: formatCount(value), unit: '' }] },
  details_seconds: { label: 'leyendo la ficha', short: (value) => `${formatDuration(value)} de ficha`, parts: durationParts },
  average_view_seconds: { label: 'en 3D por persona', short: (value) => `${formatDuration(value)} por persona`, parts: durationParts },
}
const ORDER: Metric[] = ['view_seconds', 'viewers', 'details_seconds', 'average_view_seconds']

const rankLabel = (rank: number) => String(rank).padStart(2, '0')
const titleOf = (row: AttentionRow) => row.title || 'Sin título'

// The obras ranked by the metric picked in the frame's «Ordenar por», as a
// podium: the first one large with its photo and its number as the
// headline, the next four smaller, the rest as rows with a thumbnail. Every
// bar is on one scale, the first obra's value, so the drop from one to the
// next reads at a glance. An average doesn't add up, so the tail is cut at
// the frame's limit rather than summed into «Otros». A slide shows the
// podium alone, which fills it.
export function AttentionRanking({ rows }: { rows: AttentionRow[] }) {
  const view = useChartView()
  const metric: Metric = view.sort && view.sort in METRICS ? (view.sort as Metric) : 'view_seconds'
  const sorted = [...rows].sort((a, b) => Number(b[metric]) - Number(a[metric]))
  const shown = view.limit === null ? sorted : sorted.slice(0, view.limit)
  const slide = view.mode === 'slide'
  if (slide && view.table) return <AttentionTable rows={shown} />

  const max = Number(shown[0]?.[metric]) || 0
  const [lead, ...others] = shown
  const podium = others.slice(0, 4)
  const tail = slide ? [] : others.slice(4)
  const tile = { metric, max, slide }

  return (
    <div className={slide ? 'h-full' : undefined}>
      <ol aria-label={`Obras por ${METRICS[metric].label}`} className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', slide && 'h-full grid-cols-4 grid-rows-2')}>
        {lead && <PodiumTile {...tile} row={lead} rank={1} lead />}
        {podium.map((row, index) => <PodiumTile key={row.slug} {...tile} row={row} rank={index + 2} />)}
      </ol>
      {tail.length > 0 && (
        <ol start={6} aria-label="Siguientes obras" className="mt-6 grid gap-x-8 gap-y-3 md:grid-cols-2">
          {tail.map((row, index) => <TailRow key={row.slug} metric={metric} max={max} row={row} rank={index + 6} />)}
        </ol>
      )}
      {view.table && <div className="mt-6"><AttentionTable rows={shown} /></div>}
    </div>
  )
}

// One obra of the top five. The lead takes two columns and two rows. On a
// slide the rows are short, so the photo sits beside the number instead.
function PodiumTile({ row, rank, metric, max, slide, lead = false }: { row: AttentionRow; rank: number; metric: Metric; max: number; slide: boolean; lead?: boolean }) {
  const value = Number(row[metric])
  const rest = ORDER.filter((key) => key !== metric)
  return (
    <li className={cn('group relative flex min-w-0 overflow-hidden rounded-2xl border-2 border-ink/10 bg-background', slide ? 'flex-row' : 'flex-col', lead && (slide ? 'col-span-2 row-span-2' : 'col-span-2 lg:row-span-2'))}>
      <div className={cn('relative shrink-0 overflow-hidden bg-muted', slide ? (lead ? 'w-1/2' : 'w-2/5') : lead ? 'aspect-[4/3] lg:aspect-auto lg:min-h-40 lg:flex-1' : 'aspect-[4/3]')}>
        <Photo row={row} sizes={lead ? '(min-width: 1024px) 34rem, 100vw' : '(min-width: 1024px) 16rem, 50vw'} />
        <span className={cn('font-display absolute top-3 left-3 flex items-center justify-center rounded-full bg-collage-yellow text-ink shadow-md', lead ? 'size-10 text-lg' : 'size-8 text-sm')}>{rankLabel(rank)}</span>
      </div>
      <div className={cn('flex min-w-0 flex-col', lead ? 'gap-2 p-5' : 'gap-1.5 p-3.5', slide && 'flex-1 justify-center')}>
        <Amount parts={METRICS[metric].parts(value)} className={lead ? 'text-6xl' : 'text-3xl'} />
        <span className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">{METRICS[metric].label}</span>
        <Bar value={value} max={max} slide={slide} />
        <span className={cn('mt-1 min-w-0 font-semibold text-ink', lead ? 'text-base' : 'truncate text-sm')}>
          {slide ? titleOf(row) : (
            <Link href={`/obras/${encodeURIComponent(row.slug)}`} className="after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-ink">{titleOf(row)}</Link>
          )}
          {row.artist && <span className={cn('font-normal text-muted-foreground', lead ? 'ml-2' : 'block truncate text-xs')}>{row.artist}</span>}
        </span>
        {lead && <span className="text-xs text-muted-foreground">{rest.map((key) => METRICS[key].short(Number(row[key]))).join(' · ')}</span>}
      </div>
    </li>
  )
}

function TailRow({ row, rank, metric, max }: { row: AttentionRow; rank: number; metric: Metric; max: number }) {
  const value = Number(row[metric])
  return (
    <li className="group relative grid grid-cols-[1.75rem_2.75rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-xl py-1 pr-1">
      <span className="font-display text-center text-sm text-muted-foreground">{rankLabel(rank)}</span>
      <span className="relative size-11 overflow-hidden rounded-lg bg-muted"><Photo row={row} sizes="44px" /></span>
      <span className="min-w-0">
        <Link href={`/obras/${encodeURIComponent(row.slug)}`} className="block truncate text-sm font-semibold text-ink after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ink">{titleOf(row)}</Link>
        <span className="mt-1 block"><Bar value={value} max={max} slide={false} thin /></span>
      </span>
      <span className="text-right text-sm font-bold tabular-nums text-ink">{metric === 'viewers' ? formatCount(value) : formatDuration(value)}</span>
    </li>
  )
}

function Photo({ row, sizes }: { row: AttentionRow; sizes: string }) {
  if (!row.image_url) {
    return <span className="absolute inset-0 flex items-center justify-center text-ink/25"><ImageOff className="size-5" aria-hidden="true" /></span>
  }
  return <Image src={row.image_url} alt="" fill sizes={sizes} className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none" />
}

// The number big and its unit small: «7 min 10 s».
function Amount({ parts, className }: { parts: DurationPart[]; className?: string }) {
  return (
    <strong className={cn('font-display block leading-none font-normal tracking-tight text-ink', className)}>
      {parts.map(({ value, unit }) => (
        <Fragment key={unit || 'n'}>
          {value}
          {unit && <span className="mr-[0.35em] ml-[0.12em] font-sans text-[0.38em] font-bold tracking-normal text-muted-foreground last:mr-0">{unit}</span>}
        </Fragment>
      ))}
    </strong>
  )
}

// One hue on a light step of itself (like Meter), scaled to the first obra.
function Bar({ value, max, slide, thin = false }: { value: number; max: number; slide: boolean; thin?: boolean }) {
  return (
    <span className={cn('block overflow-hidden rounded-[4px]', thin ? 'h-1.5' : 'h-2.5')} style={{ background: 'color-mix(in oklab, var(--color-chart-1) 16%, var(--chart-surface, var(--color-card)))' }} aria-hidden="true">
      <span className={cn('block h-full rounded-[4px]', barMotion(slide, 'left'))} style={{ width: `${barWidth(value, max)}%`, background: SERIES.period }} />
    </span>
  )
}

function AttentionTable({ rows }: { rows: AttentionRow[] }) {
  const { mode } = useChartView()
  const head = ['Obra', 'Personas', 'Observación 3D', 'Consulta de ficha', 'Tramos de observación', '3D por observador']
  return (
    <div className={mode === 'slide' ? 'overflow-hidden' : 'max-h-96 overflow-auto rounded-xl border border-ink/10'}>
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-card">
          <tr>{head.map((label, index) => <th key={label} scope="col" className={`border-b-2 border-ink/10 px-3 py-2 text-[10px] font-bold tracking-[0.12em] whitespace-nowrap text-muted-foreground uppercase ${index ? 'text-right' : ''}`}>{label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.slug} className="border-b border-ink/10 last:border-0">
              <th scope="row" className="max-w-64 truncate px-3 py-2 font-medium text-ink">
                {mode === 'slide' ? titleOf(row) : <Link href={`/obras/${encodeURIComponent(row.slug)}`} className="underline decoration-ink/25 underline-offset-2 hover:decoration-ink">{titleOf(row)}</Link>}
              </th>
              <td className="px-3 py-2 text-right tabular-nums">{formatCount(Number(row.viewers))}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatDuration(row.view_seconds)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatDuration(row.details_seconds)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatCount(Number(row.observations))}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatDuration(row.average_view_seconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
