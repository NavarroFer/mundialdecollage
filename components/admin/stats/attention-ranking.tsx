'use client'

import Link from 'next/link'
import { formatCount } from '@/lib/chart-math'
import { BarList } from './bar-charts'
import { useChartView } from './chart-kit'

export type AttentionRow = { slug: string; title: string | null; viewers: number; view_seconds: number; details_seconds: number; observations: number; average_view_seconds: number }
type Metric = 'viewers' | 'view_seconds' | 'details_seconds' | 'average_view_seconds'

const seconds = (value: number) => `${Number(value).toLocaleString('es-AR', { maximumFractionDigits: 1 })} s`
const METRICS: Record<Metric, { label: string; format: (value: number) => string }> = {
  viewers: { label: 'personas', format: formatCount },
  view_seconds: { label: 'observación 3D', format: seconds },
  details_seconds: { label: 'consulta de ficha', format: seconds },
  average_view_seconds: { label: '3D por observador', format: seconds },
}

// The obras ranked by the metric picked in the frame's «Ordenar por». An
// average doesn't add up, so the tail is cut rather than summed into «Otros».
export function AttentionRanking({ rows }: { rows: AttentionRow[] }) {
  const view = useChartView()
  const metric: Metric = view.sort && view.sort in METRICS ? (view.sort as Metric) : 'view_seconds'
  const sorted = [...rows].sort((a, b) => Number(b[metric]) - Number(a[metric]))
  const table = <AttentionTable rows={view.mode === 'slide' && view.limit !== null ? sorted.slice(0, view.limit) : sorted} />
  if (view.mode === 'slide' && view.table) return table
  return (
    <div>
      <BarList
        rows={sorted.map((row) => ({ label: row.title || 'Sin título', value: Number(row[metric]) }))}
        label={`Obras por ${METRICS[metric].label}`}
        note={`Ordenadas por ${METRICS[metric].label}.`}
        format={METRICS[metric].format}
        fold={false}
      />
      {view.table && <div className="mt-6">{table}</div>}
    </div>
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
                {mode === 'slide' ? row.title || 'Sin título' : <Link href={`/obras/${encodeURIComponent(row.slug)}`} className="underline decoration-ink/25 underline-offset-2 hover:decoration-ink">{row.title || 'Sin título'}</Link>}
              </th>
              <td className="px-3 py-2 text-right tabular-nums">{formatCount(Number(row.viewers))}</td>
              <td className="px-3 py-2 text-right tabular-nums">{seconds(row.view_seconds)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{seconds(row.details_seconds)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatCount(Number(row.observations))}</td>
              <td className="px-3 py-2 text-right tabular-nums">{seconds(row.average_view_seconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
