// A ranked horizontal bar row: label, a magnitude bar (scaled to the
// section's own max, not a global one), and the raw count + its share of
// `total`. Used by /admin/estadisticas for "por país" and "por técnica" —
// each section computes its own maxValue so the biggest bar in that section
// always fills the track.
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
  const sharePct = total > 0 ? Math.round((value / total) * 100) : 0

  return (
    <div className="flex items-center gap-3">
      <div className="w-36 shrink-0 truncate text-sm font-medium text-ink" title={label}>
        {label}
      </div>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${widthPct}%`, backgroundColor: color }} />
      </div>
      <div className="w-24 shrink-0 text-right text-sm tabular-nums text-ink">
        <span className="font-semibold">{value}</span> <span className="text-muted-foreground">({sharePct}%)</span>
      </div>
    </div>
  )
}
