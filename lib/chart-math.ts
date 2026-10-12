// Pure geometry and grouping for the /admin/estadisticas charts, kept out of
// React so the rules every chart shares (round ticks, which labels fit, the
// «Otros» row) are the same everywhere and tested once.

export type ChartRow = { label: string; value: number; recent?: number }

export const formatCount = (value: number) => value.toLocaleString('es-AR')

// 0 and round steps up to at least `max`: 0/10/20/30/40, 0/500/1000/1500.
// Steps of 1, 2 or 5 × 10ⁿ keep counts whole; nothing smaller than 1.
export function niceTicks(max: number, target = 4): number[] {
  if (!(max > 0)) return [0, 1]
  const rough = max / target
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude)
  const top = Math.ceil(max / step) * step
  return Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step)
}

// Which x labels to print on a `width` px axis: always the first and the
// last, and evenly spaced ones in between while each keeps `minGap` px.
export function xLabelIndexes(count: number, width: number, minGap = 76): number[] {
  if (count <= 0) return []
  if (count === 1) return [0]
  const slots = Math.max(2, Math.floor(width / minGap))
  if (count <= slots) return Array.from({ length: count }, (_, index) => index)
  const stride = Math.ceil((count - 1) / (slots - 1))
  const indexes: number[] = []
  for (let index = 0; index < count - 1; index += stride) indexes.push(index)
  // A label right before the last one would overlap it.
  if (count - 1 - (indexes.at(-1) ?? 0) < stride / 2) indexes.pop()
  return [...indexes, count - 1]
}

// With «Valores» on, label every point while the labels fit side by side,
// otherwise every nth one (always including the last).
export function valueLabelIndexes(count: number, width: number, minGap = 30): number[] {
  if (count <= 0) return []
  const spacing = count > 1 ? width / (count - 1) : width
  const stride = Math.max(1, Math.ceil(minGap / Math.max(spacing, 1)))
  const indexes = new Set<number>()
  for (let index = count - 1; index >= 0; index -= stride) indexes.add(index)
  return [...indexes].sort((a, b) => a - b)
}

// Without «Valores», only the points worth naming: the highest and the last.
export function highlightIndexes(values: number[]): number[] {
  if (!values.length) return []
  const last = values.length - 1
  const peak = values.reduce((best, value, index) => (value > values[best] ? index : best), 0)
  return values[peak] > 0 && peak !== last ? [peak, last] : [last]
}

// The first `limit` rows as given, the rest summed into one «Otros» row so
// totals and shares don't change. Folding a single row is pointless, so a
// list one row over the limit is kept whole.
export function foldRows(rows: ChartRow[], limit: number | null, othersLabel = 'Otros'): { rows: ChartRow[]; folded: number } {
  if (limit === null || rows.length <= limit + 1) return { rows, folded: 0 }
  const rest = rows.slice(limit)
  const hasRecent = rest.some((row) => row.recent !== undefined)
  const others: ChartRow = {
    label: `${othersLabel} (${rest.length})`,
    value: rest.reduce((sum, row) => sum + row.value, 0),
    ...(hasRecent ? { recent: rest.reduce((sum, row) => sum + (row.recent ?? 0), 0) } : {}),
  }
  return { rows: [...rows.slice(0, limit), others], folded: rest.length }
}

// Bar length as a percentage of the longest bar. A non-zero value always
// keeps a visible sliver so a long tail doesn't vanish next to a big bar.
export function barWidth(value: number, max: number, minimum = 2): number {
  if (!(max > 0) || !(value > 0)) return 0
  return Math.min(100, Math.max((value / max) * 100, minimum))
}

// A title as a file name: «Histórico de participaciones» → historico-de-participaciones.
export function fileSlug(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'grafico'
}
