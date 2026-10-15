import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { AttentionRanking, type AttentionRow } from '@/components/admin/stats/attention-ranking'
import { ChartFrame } from '@/components/admin/stats/chart-frame'
import { ChartError, EmptyChart } from '@/components/admin/stats/chart-kit'
import { Heart, MessageCircle } from 'lucide-react'
import { formatCount, formatDuration } from '@/lib/chart-math'

// An icon in place of a word, still named for screen readers. Drawn here:
// an icon component can't be handed to a client component as a prop.
const iconLabel = (Icon: typeof Heart, name: string) => (
  <><Icon className="size-3.5" aria-hidden="true" /><span className="sr-only">{name}</span></>
)

// Here and not in attention-ranking.tsx: a server component can't read a
// value exported by a client module.
const SORTS = [
  { value: 'view_seconds', label: 'Observación 3D' },
  { value: 'viewers', label: 'Personas' },
  { value: 'details_seconds', label: 'Ficha' },
  { value: 'average_view_seconds', label: 'Promedio' },
  { value: 'likes', label: iconLabel(Heart, 'Likes') },
  { value: 'comments', label: iconLabel(MessageCircle, 'Comentarios') },
]

type Artwork = { id: string; slug: string; title: string | null; image_url: string | null; profiles: { name: string | null } | null }
type Page = PromiseLike<{ data: unknown; error: unknown }>

// Every row of a query, a thousand at a time (Supabase's cap per request).
// Null if any page fails.
async function readPages<T>(page: (from: number, to: number) => Page): Promise<T[] | null> {
  const rows: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999)
    if (error) return null
    const batch = (data ?? []) as T[]
    rows.push(...batch)
    if (batch.length < 1000) return rows
  }
}

// «♥ 12»: the count beside its icon, the word for screen readers.
const reaction = (Icon: typeof Heart, count: number, name: string) => (
  <><Icon className="size-3" aria-hidden="true" />{formatCount(count)}<span className="sr-only"> {name}</span></>
)

function countBy(rows: { artwork_id: string }[]) {
  const counts = new Map<string, number>()
  for (const { artwork_id } of rows) counts.set(artwork_id, (counts.get(artwork_id) ?? 0) + 1)
  return counts
}

// Attention (gallery_attention_summary) plus the likes and comments left in
// the gallery since the same date, one row per obra that got any of them,
// with its photo and artist. Likes are only readable with the service role
// (artwork_likes has no grant for signed-in users), like the jury's scores
// on /admin/jurado; the rest goes through the admin's own session.
async function loadAttention(days: number) {
  const client = await createClient()
  const since = new Date(Date.now() - days * 86400000).toISOString()
  const [attention, likes, comments, artworks] = await Promise.all([
    readPages<AttentionRow>((from, to) => client.rpc('gallery_attention_summary', { since }).range(from, to)),
    readPages<{ artwork_id: string }>((from, to) => createAdminClient().from('artwork_likes').select('artwork_id').gte('created_at', since).order('artwork_id').order('email').range(from, to)),
    readPages<{ artwork_id: string }>((from, to) => client.from('artwork_comments').select('artwork_id').neq('status', 'rejected').gte('created_at', since).order('id').range(from, to)),
    readPages<Artwork>((from, to) => client.from('artworks').select('id, slug, title, image_url, profiles(name)').order('id').range(from, to)),
  ])
  if (!attention) return { data: null, error: 'attention' as const }
  if (!likes || !comments || !artworks) return { data: null, error: 'engagement' as const }

  const likesBy = countBy(likes)
  const commentsBy = countBy(comments)
  const bySlug = new Map(attention.map((row) => [row.slug, row]))
  const rows: AttentionRow[] = []
  for (const artwork of artworks) {
    const seen = bySlug.get(artwork.slug)
    const [likeCount, commentCount] = [likesBy.get(artwork.id) ?? 0, commentsBy.get(artwork.id) ?? 0]
    if (!seen && !likeCount && !commentCount) continue
    bySlug.delete(artwork.slug)
    rows.push({
      slug: artwork.slug,
      title: seen?.title ?? artwork.title,
      viewers: seen?.viewers ?? 0,
      view_seconds: seen?.view_seconds ?? 0,
      details_seconds: seen?.details_seconds ?? 0,
      observations: seen?.observations ?? 0,
      average_view_seconds: seen?.average_view_seconds ?? 0,
      likes: likeCount,
      comments: commentCount,
      image_url: artwork.image_url,
      artist: artwork.profiles?.name ?? null,
    })
  }
  // An obra the lookup missed keeps its attention, without photo or reactions.
  for (const row of bySlug.values()) rows.push({ ...row, likes: 0, comments: 0, image_url: null, artist: null })
  return { data: rows, error: null }
}

export async function GalleryAttentionStats({ days, className }: { days: number; className?: string }) {
  if (!isSupabaseConfigured) return null
  const { data, error } = await loadAttention(days)
  const rows = data ?? []
  const observed = rows.reduce((total, row) => total + Number(row.view_seconds), 0)
  const watched = rows.filter((row) => Number(row.viewers) > 0).length
  const likes = rows.reduce((total, row) => total + row.likes, 0)
  const comments = rows.reduce((total, row) => total + row.comments, 0)
  return (
    <ChartFrame
      className={className}
      eyebrow="Galería 3D"
      title="Atención por obra"
      description={`Sesiones iniciadas en los últimos ${days} días. Miradas de al menos 2 segundos, con la pestaña visible y activa. Se detiene tras 60 segundos sin actividad. La consulta de fichas se mide por separado; atención no equivale a gusto. Likes y comentarios: los que dejaron en la galería en el mismo período.`}
      footnote="Personas incluye observación o ficha. Cada tramo es una mirada sostenida; puede haber varios por persona. El promedio 3D se calcula solo entre quienes observaron en 3D. No mide exposición periférica ni seguimiento ocular. Los comentarios cuentan aprobados y pendientes, no los rechazados."
      figure={rows.length ? { value: formatDuration(observed), label: 'de observación 3D', details: [{ label: `${formatCount(watched)} obras observadas` }, { label: reaction(Heart, likes, 'likes') }, { label: reaction(MessageCircle, comments, 'comentarios') }] } : undefined}
      controls={['limit', 'table']}
      sortOptions={SORTS}
    >
      {error === 'attention' ? <ChartError>Medición no disponible. Verificá que la migración de atención esté aplicada.</ChartError>
        : error ? <ChartError>No pudimos cargar los likes y comentarios. Recargá la página para reintentar.</ChartError>
          : rows.length === 0 ? <EmptyChart>Todavía no hay observaciones, likes ni comentarios en este período.</EmptyChart>
            : <AttentionRanking rows={rows} />}
    </ChartFrame>
  )
}
