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

export function DonutChart({ slices, total, label }: { slices: Slice[]; total: number; label: string }) {
  if (!total) return <p className="py-12 text-center text-sm text-muted-foreground">Todavía no hay datos para graficar.</p>
  const segments = slices.filter((slice) => slice.value > 0).reduce<{ slice: Slice; start: number; end: number }[]>((all, slice) => {
    const start = all.at(-1)?.end ?? 0
    return [...all, { slice, start, end: start + (slice.value / total) * 360 }]
  }, [])
  return (
    <div className="grid items-center gap-5 sm:grid-cols-[10rem_1fr]">
      <div className="relative mx-auto h-40 w-40">
        <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label={label}>
          <circle cx="50" cy="50" r="38" fill="none" stroke="var(--muted)" strokeWidth="13" />
          {segments.map(({ slice, start, end }) => <path key={slice.label} d={arcPath(start + 1, end - 1)} fill="none" stroke={slice.color} strokeWidth="13" />)}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <strong className="font-display text-3xl leading-none text-ink">{total}</strong>
          <span className="mt-1 max-w-20 text-[10px] font-bold leading-tight tracking-wide text-muted-foreground uppercase">{label}</span>
        </div>
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
}: {
  steps: { label: string; week: number; month: number }[]
  base?: number
  baseLabel?: string
  periodDays: number
}) {
  const max = Math.max(...steps.map((step) => step.month), 1)
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-muted-foreground">
        <span className="flex items-center gap-1.5"><i aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-collage-blue" />Últimos {periodDays} días</span>
        <span className="flex items-center gap-1.5"><i aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-collage-red" />Últimos 7 días</span>
        {baseLabel && <span className="text-muted-foreground/80">La proporción se calcula sobre: {baseLabel}.</span>}
      </div>
      <ol className="space-y-4" aria-label="Actividad por paso">
        {steps.map((step, index) => {
          const monthWidth = (step.month / max) * 100
          const weekWidth = (step.week / max) * 100
          return (
            <li key={step.label} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3">
              <span className="font-display pt-0.5 text-lg text-collage-blue">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-sm font-semibold text-ink">{step.label}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{base ? `${formatShare(step.month, base)} · ` : ''}<b className="text-ink">{step.month}</b> / {periodDays} d</span>
                </div>
                <div className="mt-2 space-y-1.5" aria-label={`${step.label}: ${step.month} en 30 días y ${step.week} en 7 días`}>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-collage-blue" style={{ width: `${monthWidth}%` }} /></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted/70"><div className="h-full rounded-full bg-collage-red" style={{ width: `${weekWidth}%` }} /></div>
                </div>
                <p className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground"><b className="text-collage-red">{step.week}</b> en 7 días</p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
