/* eslint-disable @next/next/no-img-element -- moderation thumbnails go through /api/img */
import Link from 'next/link'
import { AdminPageHeader } from '@/components/admin/page-header'
import { SubmitButton } from '@/components/admin/submit-button'
import { adminDescription } from '@/components/admin/admin-sections'
import { createAdminClient } from '@/lib/supabase/admin'
import { imageSrc } from '@/lib/image-src'
import { POSTS_BUCKET } from '@/lib/community'
import { cn } from '@/lib/utils'
import { moderatePost, publishOfficial } from './actions'

const TABS = [
  { id: 'revisar', label: 'Para revisar', status: 'pending' },
  { id: 'denunciadas', label: 'Denunciadas' },
  { id: 'publicadas', label: 'Publicadas', status: 'published' },
  { id: 'ocultas', label: 'Ocultas', status: 'hidden' },
] as const

type PostRow = {
  id: string
  profile_id: string
  kind: string
  body: string
  status: string
  image_path: string | null
  artwork_id: string | null
  official: boolean
  report_count: number
  created_at: string
}

const dateFormat = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires',
})

export default async function PublicacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; denunciadas?: string; error?: string }>
}) {
  const params = await searchParams
  const tab = params.denunciadas === '1'
    ? TABS[1]
    : TABS.find((item) => item.id === params.tab) ?? TABS[0]
  const admin = createAdminClient()
  const listed = admin
    .from('posts')
    .select('id, profile_id, kind, body, status, image_path, artwork_id, official, report_count, created_at')
    .order(tab.id === 'denunciadas' ? 'report_count' : 'created_at', { ascending: false })
    .limit(40)
  const { data, error: loadError } = await (tab.id === 'denunciadas' ? listed.gt('report_count', 0) : listed.eq('status', tab.status ?? 'pending'))
  const posts = (data ?? []) as PostRow[]
  const names = new Map<string, string>()
  const images = new Map<string, string>()
  const profileIds = [...new Set(posts.map((post) => post.profile_id))]
  const artworkIds = posts.flatMap((post) => post.artwork_id ? [post.artwork_id] : [])
  if (profileIds.length) {
    const { data: profiles } = await admin.from('profiles').select('id, name').in('id', profileIds)
    for (const profile of profiles ?? []) if (profile.name) names.set(profile.id, profile.name)
  }
  if (artworkIds.length) {
    const { data: artworks } = await admin.from('artworks').select('id, image_url').in('id', artworkIds)
    for (const artwork of artworks ?? []) if (artwork.image_url) images.set(artwork.id, artwork.image_url)
  }

  const emails = new Map<string, string>()
  await Promise.all([...new Set(posts.map((post) => post.profile_id))].map(async (id) => {
    const { data: user } = await admin.auth.admin.getUserById(id)
    if (user.user?.email) emails.set(id, user.user.email)
  }))
  const reportReasons = new Map<string, string[]>()
  if (tab.id === 'denunciadas' && posts.length) {
    const { data: reports } = await admin.from('post_reports').select('post_id, reason').in('post_id', posts.map((post) => post.id))
    for (const report of reports ?? []) {
      const list = reportReasons.get(report.post_id) ?? []
      if (report.reason) list.push(report.reason)
      reportReasons.set(report.post_id, list)
    }
  }

  const urlOf = (post: PostRow) => (post.artwork_id && images.get(post.artwork_id))
    || (post.image_path ? admin.storage.from(POSTS_BUCKET).getPublicUrl(post.image_path).data.publicUrl : '')

  return (
    <div>
      <AdminPageHeader eyebrow="Comunidad" title="Publicaciones" description={adminDescription('/admin/publicaciones')} />
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Las obras y los souvenirs se publican al instante. Las fotos libres esperan acá. Tres denuncias ocultan una publicación hasta que la mires.
      </p>

      <form action={publishOfficial} className="mt-6 max-w-xl rounded-2xl border-2 border-ink/10 bg-card p-5">
        <h2 className="font-display text-xl tracking-tight text-ink uppercase">Nueva publicación oficial</h2>
        <p className="mt-1 text-sm text-muted-foreground">Sale al instante como «Mundial de Collage». Si la fijás, es la consigna de la semana y queda primera en el inicio.</p>
        <input type="file" name="image" accept="image/jpeg,image/png,image/webp" required className="mt-4 block text-sm" />
        <textarea name="body" rows={3} maxLength={1000} placeholder="Texto (opcional)" className="mt-3 w-full rounded-xl border-2 border-ink/15 px-3 py-2 text-sm" />
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" name="pin" /> Fijar hasta
          <input type="date" name="until" className="rounded-lg border-2 border-ink/15 px-2 py-1" />
        </label>
        <SubmitButton className="mt-4" pendingLabel="Publicando…">Publicar</SubmitButton>
      </form>

      <nav className="mt-8 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <Link key={item.id} href={`/admin/publicaciones?tab=${item.id}`} className={cn('rounded-full px-4 py-2 text-sm font-semibold', item.id === tab.id ? 'bg-ink text-paper' : 'text-muted-foreground hover:bg-card hover:text-ink')}>
            {item.label}
          </Link>
        ))}
      </nav>

      {(params.error || loadError) && (
        <p className="mt-4 rounded-xl border-2 border-collage-red/30 bg-collage-red/10 px-4 py-3 text-sm text-ink">{params.error ?? loadError?.message}</p>
      )}

      <ul className="mt-6 grid gap-3">
        {posts.length === 0 && <li className="text-muted-foreground">No hay publicaciones en esta pestaña.</li>}
        {posts.map((post) => {
          const src = urlOf(post)
          return (
            <li key={post.id} className="flex flex-col gap-3 rounded-2xl border-2 border-ink/10 bg-card p-4 sm:flex-row">
              {src && <img src={imageSrc(src, 320)} alt="" className="h-32 w-24 rounded-lg object-cover" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-semibold text-ink">{post.official ? 'Mundial de Collage' : (names.get(post.profile_id) || 'Sin nombre')}</span>
                  {emails.get(post.profile_id) && <span className="text-muted-foreground"> · {emails.get(post.profile_id)}</span>}
                  <span className="text-muted-foreground"> · {dateFormat.format(new Date(post.created_at))} · {post.kind}</span>
                  {post.report_count > 0 && <span className="text-collage-red"> · {post.report_count} denuncias</span>}
                </p>
                {post.body && <p className="mt-2 text-sm whitespace-pre-line text-ink">{post.body}</p>}
                {reportReasons.get(post.id)?.length ? <p className="mt-2 text-xs text-muted-foreground">{reportReasons.get(post.id)?.join(' · ')}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {post.status !== 'published' && (
                    <form action={moderatePost}><input type="hidden" name="id" value={post.id} /><input type="hidden" name="tab" value={tab.id} /><input type="hidden" name="action" value="publish" /><SubmitButton size="sm">Aprobar</SubmitButton></form>
                  )}
                  {post.status !== 'hidden' && post.status !== 'removed' && (
                    <form action={moderatePost}><input type="hidden" name="id" value={post.id} /><input type="hidden" name="tab" value={tab.id} /><input type="hidden" name="action" value="hide" /><SubmitButton size="sm" variant="outline">Ocultar</SubmitButton></form>
                  )}
                  {post.status !== 'removed' && (
                    <form action={moderatePost}><input type="hidden" name="id" value={post.id} /><input type="hidden" name="tab" value={tab.id} /><input type="hidden" name="action" value="remove" /><SubmitButton size="sm" variant="ghost">Borrar</SubmitButton></form>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
