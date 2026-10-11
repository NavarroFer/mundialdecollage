import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'

type Row = { slug: string; title: string | null; viewers: number; view_seconds: number; details_seconds: number; observations: number; average_view_seconds: number }
async function loadAttention(days: number) {
  const client = await createClient()
  const since = new Date(Date.now() - days * 86400000).toISOString()
  const rows: Row[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.rpc('gallery_attention_summary', { since }).range(from, from + 999)
    if (error) return { data: null, error }
    const page = (data ?? []) as Row[]
    rows.push(...page)
    if (page.length < 1000) return { data: rows, error: null }
  }
}
export async function GalleryAttentionStats({ days }: { days: number }) {
  if (!isSupabaseConfigured) return null
  const { data, error } = await loadAttention(days)
  const rows = (data ?? []) as Row[]
  const seconds = (value: number) => `${Number(value).toLocaleString('es-AR', { maximumFractionDigits: 1 })} s`
  return <section className="mt-8 rounded-3xl border-2 border-ink/10 bg-card p-5" aria-labelledby="gallery-attention-title">
    <h2 id="gallery-attention-title" className="font-display text-2xl">Atención por obra · Galería</h2>
    <p className="mt-2 text-sm text-muted-foreground">Sesiones iniciadas en los últimos {days} días. Miradas de al menos 2 segundos, con la pestaña visible y activa. Se detiene tras 60 segundos sin actividad. La consulta de fichas se mide por separado; atención no equivale a gusto.</p>
    {error ? <p className="mt-4">Medición no disponible. Verificá que la migración de atención esté aplicada.</p> : rows.length === 0 ? <p className="mt-4">Todavía no hay observaciones registradas en este período.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm">
      <thead><tr>{['Obra', 'Personas', 'Observación 3D', 'Consulta de ficha', 'Tramos de observación', '3D por observador'].map((label) => <th key={label} className="whitespace-nowrap border-b p-3">{label}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row.slug}>
        <td className="border-b p-3"><Link href={`/obras/${encodeURIComponent(row.slug)}`} className="underline">{row.title || 'Sin título'}</Link></td>
        <td className="border-b p-3">{row.viewers}</td><td className="border-b p-3">{seconds(row.view_seconds)}</td><td className="border-b p-3">{seconds(row.details_seconds)}</td><td className="border-b p-3">{row.observations}</td><td className="border-b p-3">{seconds(row.average_view_seconds)}</td>
      </tr>)}</tbody>
    </table></div>}
    <p className="mt-3 text-xs text-muted-foreground">Personas incluye observación o ficha. Cada tramo es una mirada sostenida; puede haber varios por persona. El promedio 3D se calcula solo entre quienes observaron en 3D. No mide exposición periférica ni seguimiento ocular.</p>
  </section>
}
