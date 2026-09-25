import Link from 'next/link'
import { Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AdminPageHeader, StatPill } from '@/components/admin/page-header'
import { SubmitButton } from '@/components/admin/submit-button'
import { cn } from '@/lib/utils'
import { approveComment, rejectComment } from './actions'

const TABS = [
  { id: 'pendientes', label: 'Pendientes', status: 'pending' },
  { id: 'aprobados', label: 'Aprobados', status: 'approved' },
  { id: 'rechazados', label: 'Rechazados', status: 'rejected' },
] as const

type CommentRow = {
  id: string
  author_name: string
  author_email: string | null
  body: string
  created_at: string
  artworks: { title: string; slug: string; image_url: string } | null
}

const dateFormat = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires',
})

export default async function ComentariosPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; error?: string }>
}) {
  const { tab: tabParam, error } = await searchParams
  const tab = TABS.find((t) => t.id === tabParam) ?? TABS[0]
  const supabase = await createClient()

  const [{ data, error: loadError }, pendingCount] = await Promise.all([
    supabase
      .from('artwork_comments')
      .select('id, author_name, author_email, body, created_at, artworks(title, slug, image_url)')
      .eq('status', tab.status)
      .order('created_at', { ascending: tab.status === 'pending' })
      .limit(200),
    supabase.from('artwork_comments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ])
  // A many-to-one embed comes back as one object at runtime, but without
  // generated DB types supabase-js infers an array (see lib/finalists.ts).
  const comments = (data ?? []) as unknown as CommentRow[]

  return (
    <div>
      <AdminPageHeader eyebrow="Galería 3D" title="Comentarios" />

      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Los comentarios que la gente deja en las obras de la Galería 3D (con su cuenta de Google) solo se publican
        cuando los aprobás. Quien lo escribió lo ve como &quot;Esperando aprobación&quot; hasta entonces.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <StatPill label="Pendientes" value={pendingCount.count ?? 0} />
      </div>

      <nav className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin/comentarios?tab=${t.id}`}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-semibold',
              t.id === tab.id ? 'bg-ink text-paper' : 'text-muted-foreground hover:bg-card hover:text-ink',
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {(error || loadError) && (
        <p className="mt-4 rounded-xl border-2 border-collage-red/30 bg-collage-red/10 px-4 py-3 text-sm text-ink">
          {error ?? loadError?.message}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {comments.length === 0 && (
          <p className="text-muted-foreground">
            {tab.status === 'pending' ? 'No hay comentarios esperando moderación.' : 'Todavía no hay comentarios acá.'}
          </p>
        )}
        {comments.map((comment) => (
          <article key={comment.id} className="flex gap-4 rounded-2xl border-2 border-ink/10 bg-card p-4 sm:p-5">
            {comment.artworks && (
              <Link href={`/obras/${comment.artworks.slug}`} target="_blank" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={comment.artworks.image_url} alt={comment.artworks.title}
                  className="h-16 w-16 rounded-lg border-2 border-ink/10 object-cover sm:h-20 sm:w-20" />
              </Link>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-ink">{comment.author_name}</span>
                {comment.author_email && <> · {comment.author_email}</>}
                {' · '}
                {dateFormat.format(new Date(comment.created_at))}
                {comment.artworks && <> · en «{comment.artworks.title}»</>}
              </p>
              <p className="mt-2 whitespace-pre-line break-words text-ink">{comment.body}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {tab.status !== 'approved' && (
                  <form action={approveComment}>
                    <input type="hidden" name="id" value={comment.id} />
                    <input type="hidden" name="tab" value={tab.id} />
                    <SubmitButton size="sm" className="gap-1.5" pendingLabel="Aprobando…">
                      <Check className="h-3.5 w-3.5" />
                      Aprobar
                    </SubmitButton>
                  </form>
                )}
                {tab.status !== 'rejected' && (
                  <form action={rejectComment}>
                    <input type="hidden" name="id" value={comment.id} />
                    <input type="hidden" name="tab" value={tab.id} />
                    <SubmitButton size="sm" variant="outline" className="gap-1.5" pendingLabel="Guardando…">
                      <X className="h-3.5 w-3.5" />
                      {tab.status === 'approved' ? 'Ocultar' : 'Rechazar'}
                    </SubmitButton>
                  </form>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
