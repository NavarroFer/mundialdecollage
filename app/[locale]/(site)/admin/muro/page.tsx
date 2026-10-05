import Link from 'next/link'
import { Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AdminPageHeader, StatPill } from '@/components/admin/page-header'
import { SubmitButton } from '@/components/admin/submit-button'
import { adminDescription } from '@/components/admin/admin-sections'
import { WALL_BUCKET } from '@/lib/collage-wall'
import { imageSrc } from '@/lib/image-src'
import { cn } from '@/lib/utils'
import { approvePiece, rejectPiece } from './actions'

const TABS = [
  { id: 'pendientes', label: 'Pendientes', status: 'pending' },
  { id: 'aprobadas', label: 'Aprobadas', status: 'approved' },
  { id: 'rechazadas', label: 'Rechazadas', status: 'rejected' },
] as const

type PieceRow = {
  id: string
  author_name: string
  author_email: string | null
  image_path: string
  week_start: string
  created_at: string
}

const dateFormat = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires',
})
const weekFormat = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' })

export default async function MuroPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; error?: string }>
}) {
  const { tab: tabParam, error } = await searchParams
  const tab = TABS.find((t) => t.id === tabParam) ?? TABS[0]
  const supabase = await createClient()

  const [{ data, error: loadError }, pendingCount] = await Promise.all([
    supabase
      .from('wall_pieces')
      .select('id, author_name, author_email, image_path, week_start, created_at')
      .eq('status', tab.status)
      .order('created_at', { ascending: tab.status === 'pending' })
      .limit(200),
    supabase.from('wall_pieces').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ])
  const pieces = (data ?? []) as PieceRow[]
  // Rejected photos are deleted from Storage: only their record remains.
  const photoUrl = (path: string) => supabase.storage.from(WALL_BUCKET).getPublicUrl(path).data.publicUrl

  return (
    <div>
      <AdminPageHeader eyebrow="Galería 3D" eyebrowHref="/galeria-3d" title="Collage colectivo" description={adminDescription('/admin/muro')} />

      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Las fotos que la gente pega en el cuadro grande de la Sala 1 (con su cuenta de Google) solo las ven los demás
        cuando las aprobás. Quien la pegó la ve enseguida, un poco transparente. Cada lunes arranca un cuadro nuevo.
        Al rechazar una foto se borra el archivo y a esa persona le vuelve la vida.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <StatPill label="Pendientes" value={pendingCount.count ?? 0} />
      </div>

      <nav className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin/muro?tab=${t.id}`}
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

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {pieces.length === 0 && (
          <p className="text-muted-foreground">
            {tab.status === 'pending' ? 'No hay fotos esperando moderación.' : 'Todavía no hay fotos acá.'}
          </p>
        )}
        {pieces.map((piece, index) => {
          const nextPieceId = tab.status === 'pending' ? pieces[index + 1]?.id : undefined
          return (
            <article id={`piece-${piece.id}`} key={piece.id} className="scroll-mt-6 flex flex-col gap-3 rounded-2xl border-2 border-ink/10 bg-card p-4">
              {tab.status !== 'rejected' && (
                <a href={photoUrl(piece.image_path)} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageSrc(photoUrl(piece.image_path), 640)} alt={`Foto de ${piece.author_name}`}
                    className="max-h-80 w-full rounded-lg border-2 border-ink/10 bg-paper object-contain" />
                </a>
              )}
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-ink">{piece.author_name}</span>
                {piece.author_email && <> · {piece.author_email}</>}
                {' · '}
                {dateFormat.format(new Date(piece.created_at))}
                {' · '}cuadro del {weekFormat.format(new Date(`${piece.week_start}T12:00:00-03:00`))}
              </p>
              <div className="flex flex-wrap gap-2">
                {tab.status === 'pending' && (
                  <form action={approvePiece}>
                    <input type="hidden" name="id" value={piece.id} />
                    <input type="hidden" name="tab" value={tab.id} />
                    {nextPieceId && <input type="hidden" name="next" value={nextPieceId} />}
                    <SubmitButton size="sm" className="gap-1.5" pendingLabel="Aprobando…">
                      <Check className="h-3.5 w-3.5" />
                      {nextPieceId ? 'Aprobar y seguir' : 'Aprobar'}
                    </SubmitButton>
                  </form>
                )}
                {tab.status !== 'rejected' && (
                  <form action={rejectPiece}>
                    <input type="hidden" name="id" value={piece.id} />
                    <input type="hidden" name="tab" value={tab.id} />
                    {nextPieceId && <input type="hidden" name="next" value={nextPieceId} />}
                    <SubmitButton size="sm" variant="outline" className="gap-1.5" pendingLabel="Guardando…">
                      <X className="h-3.5 w-3.5" />
                      {tab.status === 'approved' ? 'Sacar del cuadro' : nextPieceId ? 'Rechazar y seguir' : 'Rechazar'}
                    </SubmitButton>
                  </form>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
