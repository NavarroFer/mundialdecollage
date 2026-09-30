import { formatShare } from '@/lib/artwork-stats'

type Slice = { label: string; value: number; color: string }

function polar(cx: number, cy: number, radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) }
}

function arcPath(start: number, end: number) {
  const startPoint = polar(50, 50, 38, end)
  const endPoint = polar(50, 50, 38, start)
  const largeArc = end - start > 180 ? 1 : 0
  return `M ${startPoint.x} ${startPoint.y} A 38 38 0 ${largeArc} 0 ${endPoint.x} ${endPoint.y}`
}

export function DonutChart({
  slices,
  total,
  label,
  variant = 'donut',
}: {
  slices: Slice[]
  total: number
  label: string
  variant?: 'donut' | 'pie'
}) {
  if (!total) return <p className="py-12 text-center text-sm text-muted-foreground">Todavía no hay datos para graficar.</p>
  const strokeWidth = variant === 'pie' ? 76 : 13
  const segments = slices.filter((slice) => slice.value > 0).reduce<{ slice: Slice; start: number; end: number }[]>((all, slice) => {
    const start = all.at(-1)?.end ?? 0
    return [...all, { slice, start, end: start + (slice.value / total) * 360 }]
  }, [])
  return (
    <div className="grid items-center gap-5 sm:grid-cols-[10rem_1fr]">
      <div className="relative mx-auto h-40 w-40">
        <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label={label}>
          <circle cx="50" cy="50" r="38" fill="none" stroke="var(--muted)" strokeWidth={strokeWidth} />
          {segments.map(({ slice, start, end }) => <path key={slice.label} d={arcPath(start + 0.7, end - 0.7)} fill="none" stroke={slice.color} strokeWidth={strokeWidth} />)}
        </svg>
        {variant === 'donut' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <strong className="font-display text-3xl leading-none text-ink">{total}</strong>
            <span className="mt-1 max-w-20 text-[10px] font-bold leading-tight tracking-wide text-muted-foreground uppercase">{label}</span>
          </div>
        )}
      </div>
      <ul className="space-y-2.5" aria-label={`${label}: detalle`}>
        {slices.map((slice) => (
          <li key={slice.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-ink"><i aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: slice.color }} />{slice.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground"><b className="text-ink">{slice.value}</b> · {formatShare(slice.value, total)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function DailyActivityChart({ data, days }: { data: { label: string; value: number }[]; days: number }) {
  const width = 640
  const height = 190
  const inset = 18
  const max = Math.max(...data.map((point) => point.value), 1)
  const points = data.map((point, index) => ({
    ...point,
    x: inset + (index * (width - inset * 2)) / Math.max(data.length - 1, 1),
    y: height - inset - (point.value / max) * (height - inset * 2),
  }))
  const line = points.map((point) => `${point.x},${point.y}`).join(' ')
  const area = `${inset},${height - inset} ${line} ${width - inset},${height - inset}`
  const total = data.reduce((sum, point) => sum + point.value, 0)
  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <p className="text-sm text-muted-foreground">Visitas únicas a la galería por día</p>
        <strong className="font-display shrink-0 text-2xl text-ink">{total}<span className="ml-1 font-sans text-xs font-semibold tracking-wide text-muted-foreground uppercase">en {days} días</span></strong>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full overflow-visible" role="img" aria-label="Evolución diaria de visitas únicas a la galería">
        {[0.25, 0.5, 0.75].map((step) => <line key={step} x1={inset} x2={width - inset} y1={height - inset - step * (height - inset * 2)} y2={height - inset - step * (height - inset * 2)} stroke="var(--border)" strokeDasharray="3 5" />)}
        <polygon points={area} fill="var(--color-collage-blue)" opacity="0.12" />
        <polyline points={line} fill="none" stroke="var(--color-collage-blue)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => <g key={point.label}><circle cx={point.x} cy={point.y} r="3.5" fill="var(--color-collage-blue)"><title>{`${point.label}: ${point.value}`}</title></circle></g>)}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] font-semibold tracking-wide text-muted-foreground uppercase"><span>{data[0]?.label}</span><span>{data.at(-1)?.label}</span></div>
    </div>
  )
}

export function FunnelChart({ steps, periodDays }: { steps: { label: string; value: number }[]; periodDays: number }) {
  const base = steps[0]?.value ?? 0
  return (
    <ol className="space-y-3" aria-label={`Embudo de la galería, últimos ${periodDays} días`}>
      {steps.map((step, index) => {
        const width = base ? Math.max((step.value / base) * 100, step.value ? 8 : 0) : 0
        return <li key={step.label} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-3">
          <span className="font-display text-lg text-collage-blue">0{index + 1}</span>
          <div><div className="flex justify-between gap-3 text-xs font-semibold text-ink"><span>{step.label}</span><span>{formatShare(step.value, base)}</span></div><div className="mt-1.5 h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-collage-blue" style={{ width: `${width}%`, opacity: 1 - index * 0.12 }} /></div></div>
          <strong className="tabular-nums text-sm text-ink">{step.value}</strong>
        </li>
      })}
    </ol>
  )
}

export function JourneyComparison({
  steps,
  base,
  baseLabel,
  periodDays,
  comparisonDays,
  variant = 'funnel',
}: {
  steps: { label: string; week: number; month: number }[]
  base?: number
  baseLabel?: string
  periodDays: number
  comparisonDays: number
  variant?: 'funnel' | 'comparison'
}) {
  const max = Math.max(...steps.map((step) => step.month), 1)
  const funnelStart = Math.max(steps[0]?.month ?? 0, 1)
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-muted-foreground">
        <span className="flex items-center gap-1.5"><i aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-collage-blue" />Últimos {periodDays} días</span>
        <span className="flex items-center gap-1.5"><i aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-collage-red" />Últimos {comparisonDays} {comparisonDays === 1 ? 'día' : 'días'}</span>
        {baseLabel && <span className="text-muted-foreground/80">La proporción se calcula sobre: {baseLabel}.</span>}
      </div>
      {variant === 'funnel' ? (
      <ol className="space-y-1.5" aria-label={`Embudo de actividad, últimos ${periodDays} días`}>
        {steps.map((step, index) => {
          // Keep even small, non-zero stages legible. The widths are relative
          // to the busiest stage, so routes whose events are not strictly
          // sequential still read honestly as relative volume.
          const funnelWidth = Math.min(100, Math.max((step.month / funnelStart) * 100, step.month > 0 ? 48 : 34))
          return (
            <li
              key={step.label}
              className="relative mx-auto min-h-20 overflow-hidden bg-collage-blue px-8 py-4 text-primary-foreground shadow-[3px_3px_0_color-mix(in_oklab,var(--color-ink)_18%,transparent)] transition-[width] duration-300"
              style={{ width: `${funnelWidth}%`, clipPath: 'polygon(4% 0, 96% 0, 100% 100%, 0 100%)' }}
            >
              <div className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4">
                <span className="font-display flex h-7 w-7 items-center justify-center rounded-full bg-collage-yellow text-sm text-ink">{String(index + 1).padStart(2, '0')}</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-tight text-primary-foreground">{step.label}</p>
                  <p className="mt-1 text-[10px] font-semibold tracking-wide text-primary-foreground/75 uppercase">
                    {base ? `${formatShare(step.month, base)} del recorrido` : 'Actividad acumulada'}
                  </p>
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <strong className="font-display flex h-12 min-w-12 items-center justify-center rounded-full bg-paper px-2 text-3xl leading-none tracking-tight text-collage-blue">{step.month}</strong>
                  <span className="mt-1 block text-[10px] font-bold tracking-wide text-primary-foreground/80 uppercase"><b className="text-collage-yellow">{step.week}</b> · {comparisonDays} d</span>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      ) : (
        <ol className="space-y-3" aria-label={`Comparación de acciones, últimos ${periodDays} días`}>
          {steps.map((step, index) => {
            const width = Math.max((step.month / max) * 100, step.month > 0 ? 5 : 0)
            return (
              <li key={step.label} className="rounded-xl border border-ink/10 bg-background p-3">
                <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-start gap-3">
                  <span className="font-display flex h-7 w-7 items-center justify-center rounded-full bg-collage-yellow text-sm text-ink">{String(index + 1).padStart(2, '0')}</span>
                  <p className="pt-1 text-sm font-semibold leading-tight text-ink">{step.label}</p>
                  <span className="text-right tabular-nums"><strong className="font-display text-2xl leading-none text-ink">{step.month}</strong><span className="mt-1 block text-[10px] font-bold tracking-wide text-collage-red uppercase">{step.week} · {comparisonDays} d</span></span>
                </div>
                <div className="mt-3 ml-10 h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className="h-full rounded-full bg-collage-blue" style={{ width: `${width}%` }} /></div>
                <p className="mt-1.5 ml-10 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{base ? `${formatShare(step.month, base)} sobre la base` : 'Volumen relativo de la acción'}</p>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
