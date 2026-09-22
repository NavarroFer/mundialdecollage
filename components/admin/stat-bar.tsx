// A ranked horizontal bar row: label, a magnitude bar (scaled to the
// section's own max, not a global one), and the raw count + its share of
// `total`. Used by /admin/estadisticas for "por país" and "por técnica" —
// each section computes its own maxValue so the biggest bar in that section
// always fills the track.
import { formatShare } from '@/lib/artwork-stats'

export function StatBar({
  label,
  value,
  maxValue,
  total,
  color,
}: {
  label: string
  value: number
  maxValue: number
  total: number
  color: string
}) {
  // A nonzero value always renders a visible sliver (min 4%) — otherwise a
  // long tail of small counts next to one dominant bar would render as
  // invisible hairlines.
  const widthPct = maxValue > 0 ? Math.max((value / maxValue) * 100, value > 0 ? 4 : 0) : 0
  const sharePct = formatShare(value, total)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2">
      <div className="text-sm font-medium text-ink">
        {label}
      </div>
      <div aria-hidden="true" className="col-span-2 row-start-2 h-3 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${widthPct}%`, backgroundColor: color }} />
      </div>
      <div className="text-right text-sm tabular-nums text-ink">
        <span className="font-semibold">{value}</span> <span className="text-muted-foreground">({sharePct})</span>
      </div>
    </div>
  )
}
