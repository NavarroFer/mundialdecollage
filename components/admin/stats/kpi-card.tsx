import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// A headline number, the way the page opens each area: what it counts, the
// number big, what it covers and, as a chip, its latest stretch. With a series
// behind it, its shape sits in small bars, the latest one solid. `highlight`
// inks the card, for the one number each row leads with.
export function KpiCard({ label, value, context, recent, series, highlight = false }: {
  label: string
  value: string
  /** What the number covers: «Últimos 30 días», «Desde el inicio». */
  context: string
  /** The same number over the latest stretch: «412 · últimos 7 días». */
  recent?: string
  series?: number[]
  highlight?: boolean
}) {
  return (
    <div className={cn('flex min-w-0 flex-col rounded-3xl border-2 p-4 sm:p-6', highlight ? 'border-ink bg-ink text-paper' : 'border-ink/10 bg-card text-ink')}>
      <p className={cn('text-[10px] font-bold tracking-[0.16em] uppercase sm:text-xs sm:tracking-[0.18em]', highlight ? 'text-paper/70' : 'text-muted-foreground')}>{label}</p>
      <div className="mt-auto flex items-end justify-between gap-3 pt-4 sm:pt-5">
        <p className="font-display text-4xl leading-none tracking-tight tabular-nums sm:text-5xl">{value}</p>
        {series && series.length > 1 && <Sparkbars values={series} className={cn('mb-1 hidden sm:block', highlight ? 'text-paper' : 'text-collage-blue')} />}
      </div>
      <p className={cn('mt-2 text-xs leading-snug', highlight ? 'text-paper/65' : 'text-muted-foreground')}>{context}</p>
      {recent && (
        <p className={cn('mt-3 self-start rounded-full px-2.5 py-1 text-xs font-bold tabular-nums', highlight ? 'bg-paper/15 text-paper' : 'bg-collage-blue/10 text-collage-blue')}>
          {recent}
        </p>
      )}
    </div>
  )
}

export function KpiStrip({ label, children }: { label: string; children: ReactNode }) {
  return <section aria-label={label} className="grid grid-cols-2 gap-3 xl:grid-cols-4">{children}</section>
}

// The last 30 values at most, in the card's own color: a shape, not a chart
// to read (the full chart is in its tab), so it's hidden from screen readers.
function Sparkbars({ values, className }: { values: number[]; className: string }) {
  const shown = values.slice(-30)
  const max = Math.max(...shown, 1)
  const width = 96
  const height = 40
  const gap = shown.length > 20 ? 1 : 2
  const bar = (width - gap * (shown.length - 1)) / shown.length
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cn('h-9 w-24 shrink-0', className)} aria-hidden="true">
      {shown.map((value, index) => {
        const barHeight = Math.max(2, (value / max) * height)
        return (
          <rect
            key={index}
            x={index * (bar + gap)}
            y={height - barHeight}
            width={bar}
            height={barHeight}
            rx={Math.min(1.5, bar / 2)}
            fill="currentColor"
            fillOpacity={index === shown.length - 1 ? 1 : 0.3}
          />
        )
      })}
    </svg>
  )
}
