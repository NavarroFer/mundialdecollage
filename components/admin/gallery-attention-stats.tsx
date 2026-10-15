import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { AttentionRanking, type AttentionRow } from '@/components/admin/stats/attention-ranking'
import { ChartFrame } from '@/components/admin/stats/chart-frame'
import { ChartError, EmptyChart } from '@/components/admin/stats/chart-kit'
import { formatDuration } from '@/lib/chart-math'

// Here and not in attention-ranking.tsx: a server component can't read a
// value exported by a client module.
const SORTS = [
  { value: 'view_seconds', label: 'Observación 3D' },
  { value: 'viewers', label: 'Personas' },
  { value: 'details_seconds', label: 'Ficha' },
  { value: 'average_view_seconds', label: 'Promedio' },
]

async function loadAttention(days: number) {
  const client = await createClient()
  const since = new Date(Date.now() - days * 86400000).toISOString()
  const rows: AttentionRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.rpc('gallery_attention_summary', { since }).range(from, from + 999)
    if (error) return { data: null, error }
    const page = (data ?? []) as AttentionRow[]
    rows.push(...page)
    if (page.length < 1000) break
  }
  return { data: await withArtworks(client, rows), error: null }
}

// The ranking shows each obra's photo and artist, which the summary doesn't
// carry. Looked up by slug, a hundred at a time to keep the URL short; an
// obra that can't be found keeps its numbers and goes without a photo.
async function withArtworks(client: Awaited<ReturnType<typeof createClient>>, rows: AttentionRow[]): Promise<AttentionRow[]> {
  const artworks = new Map<string, { image_url: string | null; artist: string | null }>()
  for (let index = 0; index < rows.length; index += 100) {
    const slugs = rows.slice(index, index + 100).map((row) => row.slug)
    const { data } = await client.from('artworks').select('slug, image_url, profiles(name)').in('slug', slugs)
    for (const artwork of (data ?? []) as unknown as { slug: string; image_url: string | null; profiles: { name: string | null } | null }[]) {
      artworks.set(artwork.slug, { image_url: artwork.image_url, artist: artwork.profiles?.name ?? null })
    }
  }
  return rows.map((row) => ({ ...row, image_url: null, artist: null, ...artworks.get(row.slug) }))
}
export async function GalleryAttentionStats({ days, className }: { days: number; className?: string }) {
  if (!isSupabaseConfigured) return null
  const { data, error } = await loadAttention(days)
  const rows = data ?? []
  const observed = rows.reduce((total, row) => total + Number(row.view_seconds), 0)
  return (
    <ChartFrame
      className={className}
      eyebrow="Galería 3D"
      title="Atención por obra"
      description={`Sesiones iniciadas en los últimos ${days} días. Miradas de al menos 2 segundos, con la pestaña visible y activa. Se detiene tras 60 segundos sin actividad. La consulta de fichas se mide por separado; atención no equivale a gusto.`}
      footnote="Personas incluye observación o ficha. Cada tramo es una mirada sostenida; puede haber varios por persona. El promedio 3D se calcula solo entre quienes observaron en 3D. No mide exposición periférica ni seguimiento ocular."
      figure={rows.length ? { value: formatDuration(observed), label: 'de observación 3D', details: [{ label: `${rows.length} obras observadas` }] } : undefined}
      controls={['limit', 'table']}
      sortOptions={SORTS}
    >
      {error ? <ChartError>Medición no disponible. Verificá que la migración de atención esté aplicada.</ChartError>
        : rows.length === 0 ? <EmptyChart>Todavía no hay observaciones registradas en este período.</EmptyChart>
          : <AttentionRanking rows={rows} />}
    </ChartFrame>
  )
}
