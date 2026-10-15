'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Heart, ImageOff, MessageCircle, type LucideIcon } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
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
  // Left in the gallery in the same period; the rest is from the obra itself
  // (gallery-attention-stats.tsx), not the summary.
  likes: number
  comments: number
  image_url?: string | null
  artist?: string | null
}
type Metric = 'viewers' | 'view_seconds' | 'details_seconds' | 'average_view_seconds' | 'likes' | 'comments'

const count = (value: number): DurationPart[] => [{ value: formatCount(value), unit: '' }]

// `label` goes under the headline number (or, with an `icon`, the icon goes
// beside it and the word is for screen readers), `format` is the value in a
// row and `short` names it in the lead's line of the other attention numbers.
type MetricSpec = { label: string; icon?: LucideIcon; format: (value: number) => string; short: (value: number) => string; parts: (value: number) => DurationPart[] }
const METRICS: Record<Metric, MetricSpec> = {
  view_seconds: { label: 'de observación 3D', format: formatDuration, short: (value) => `${formatDuration(value)} en 3D`, parts: durationParts },
  viewers: { label: 'personas', format: formatCount, short: (value) => `${formatCount(value)} ${value === 1 ? 'persona' : 'personas'}`, parts: count },
  details_seconds: { label: 'leyendo la ficha', format: formatDuration, short: (value) => `${formatDuration(value)} de ficha`, parts: durationParts },
  average_view_seconds: { label: 'en 3D por persona', format: formatDuration, short: (value) => `${formatDuration(value)} por persona`, parts: durationParts },
  likes: { label: 'likes', icon: Heart, format: formatCount, short: (value) => `${formatCount(value)} likes`, parts: count },
  comments: { label: 'comentarios', icon: MessageCircle, format: formatCount, short: (value) => `${formatCount(value)} comentarios`, parts: count },
}
// The likes and comments have their own icons on every obra (Reactions).
const ATTENTION: Metric[] = ['view_seconds', 'viewers', 'details_seconds', 'average_view_seconds']

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
  // Ties (many obras have no likes yet) fall back to observation time.
  const sorted = [...rows].sort((a, b) => Number(b[metric]) - Number(a[metric]) || Number(b.view_seconds) - Number(a.view_seconds))
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
  const rest = ATTENTION.filter((key) => key !== metric)
  return (
    <li className={cn('group relative flex min-w-0 overflow-hidden rounded-2xl border-2 border-ink/10 bg-background', slide ? 'flex-row' : 'flex-col', lead && (slide ? 'col-span-2 row-span-2' : 'col-span-2 lg:row-span-2'))}>
      <div className={cn('relative shrink-0 overflow-hidden bg-muted', slide ? (lead ? 'w-1/2' : 'w-2/5') : lead ? 'aspect-[4/3] lg:aspect-auto lg:min-h-40 lg:flex-1' : 'aspect-[4/3]')}>
        <Photo row={row} sizes={lead ? '(min-width: 1024px) 34rem, 100vw' : '(min-width: 1024px) 16rem, 50vw'} />
        <span className={cn('font-display absolute top-3 left-3 flex items-center justify-center rounded-full bg-collage-yellow text-ink shadow-md', lead ? 'size-10 text-lg' : 'size-8 text-sm')}>{rankLabel(rank)}</span>
      </div>
      <div className={cn('flex min-w-0 flex-col', lead ? 'gap-2 p-5' : 'gap-1.5 p-3.5', slide && 'flex-1 justify-center')}>
        <Headline spec={METRICS[metric]} value={value} lead={lead} />
        <Bar value={value} max={max} slide={slide} />
        <span className={cn('mt-1 min-w-0 font-semibold text-ink', lead ? 'text-base' : 'truncate text-sm')}>
          {slide ? titleOf(row) : (
            <Link href={`/obras/${encodeURIComponent(row.slug)}`} className="after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-ink">{titleOf(row)}</Link>
          )}
          {row.artist && <span className={cn('font-normal text-muted-foreground', lead ? 'ml-2' : 'block truncate text-xs')}>{row.artist}</span>}
        </span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Reactions row={row} except={metric} />
          {lead && <span className="text-xs text-muted-foreground">{Number(row.viewers) > 0 ? rest.map((key) => METRICS[key].short(Number(row[key]))).join(' · ') : 'Sin observación 3D en el período'}</span>}
        </span>
      </div>
    </li>
  )
}

function TailRow({ row, rank, metric, max }: { row: AttentionRow; rank: number; metric: Metric; max: number }) {
  const value = Number(row[metric])
  const Icon = METRICS[metric].icon
  return (
    <li className="group relative grid grid-cols-[1.75rem_2.75rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-xl py-1 pr-1">
      <span className="font-display text-center text-sm text-muted-foreground">{rankLabel(rank)}</span>
      <span className="relative size-11 overflow-hidden rounded-lg bg-muted"><Photo row={row} sizes="44px" /></span>
      <span className="min-w-0">
        <span className="flex items-center gap-3">
          <Link href={`/obras/${encodeURIComponent(row.slug)}`} className="min-w-0 flex-1 truncate text-sm font-semibold text-ink after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ink">{titleOf(row)}</Link>
          <Reactions row={row} except={metric} />
        </span>
        <span className="mt-1 block"><Bar value={value} max={max} slide={false} thin /></span>
      </span>
      <span className="inline-flex items-center justify-end gap-1 text-sm font-bold tabular-nums text-ink">
        {Icon && <Icon className="size-3.5" aria-hidden="true" />}
        {METRICS[metric].format(value)}
        {Icon && <span className="sr-only"> {METRICS[metric].label}</span>}
      </span>
    </li>
  )
}

// Likes and comments, on every obra whatever the ranking is sorted by,
// except the one already shown as the obra's number. In text colors, not a
// series color, so they don't read as chart data.
function Reactions({ row, except }: { row: AttentionRow; except: Metric }) {
  const items = [
    { key: 'likes', icon: Heart, value: row.likes, label: row.likes === 1 ? 'like' : 'likes' },
    { key: 'comments', icon: MessageCircle, value: row.comments, label: row.comments === 1 ? 'comentario' : 'comentarios' },
  ].filter(({ key }) => key !== except)
  return (
    <span className="flex shrink-0 items-center gap-2.5 text-xs font-semibold tabular-nums">
      {items.map(({ icon: Icon, value, label }) => (
        <span key={label} className={cn('inline-flex items-center gap-1', value > 0 ? 'text-ink' : 'text-muted-foreground/70')}>
          <Icon className="size-3.5" aria-hidden="true" />
          {formatCount(value)}
          <span className="sr-only">{label}</span>
        </span>
      ))}
    </span>
  )
}

function Photo({ row, sizes }: { row: AttentionRow; sizes: string }) {
  if (!row.image_url) {
    return <span className="absolute inset-0 flex items-center justify-center text-ink/25"><ImageOff className="size-5" aria-hidden="true" /></span>
  }
  return <Image src={row.image_url} alt="" fill sizes={sizes} className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none" />
}

// The obra's number for the metric sorted by: «7 min 10 s» over its name,
// or «♥ 12» with the icon in place of the word.
function Headline({ spec, value, lead }: { spec: MetricSpec; value: number; lead: boolean }) {
  const amount = <Amount parts={spec.parts(value)} className={lead ? 'text-6xl' : 'text-3xl'} />
  const Icon = spec.icon
  if (!Icon) {
    return <>{amount}<span className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">{spec.label}</span></>
  }
  return (
    <span className="flex items-center gap-2">
      <Icon className={cn('shrink-0 text-ink', lead ? 'size-11' : 'size-6')} strokeWidth={2.25} aria-hidden="true" />
      {amount}
      <span className="sr-only">{spec.label}</span>
    </span>
  )
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
  const head: { key: string; label: ReactNode }[] = [
    ...['Obra', 'Personas', 'Observación 3D', 'Consulta de ficha', 'Tramos de observación', '3D por observador'].map((label) => ({ key: label, label })),
    { key: 'likes', label: <span className="inline-flex justify-end"><Heart className="size-3.5" aria-hidden="true" /><span className="sr-only">Likes</span></span> },
    { key: 'comments', label: <span className="inline-flex justify-end"><MessageCircle className="size-3.5" aria-hidden="true" /><span className="sr-only">Comentarios</span></span> },
  ]
  return (
    <div className={mode === 'slide' ? 'overflow-hidden' : 'max-h-96 overflow-auto rounded-xl border border-ink/10'}>
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-card">
          <tr>{head.map(({ key, label }, index) => <th key={key} scope="col" className={`border-b-2 border-ink/10 px-3 py-2 text-[10px] font-bold tracking-[0.12em] whitespace-nowrap text-muted-foreground uppercase ${index ? 'text-right' : ''}`}>{label}</th>)}</tr>
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
              <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.likes)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.comments)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
