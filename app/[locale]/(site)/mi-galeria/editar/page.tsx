import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { SubmitButton } from '@/components/admin/submit-button'
import { ArrowLeft, Check, ChevronRight, Clock, Coins, Eye, FileText, Frame, Heart, Images, LayoutDashboard, Lock, MapPin, Palette, ShoppingBag, Sparkles, Stamp, StickyNote, Trash2, Upload, X } from 'lucide-react'
import { galleryThemes, type GalleryTheme } from '@/components/gallery/themes'
import { FramePreview, RoomPreview, ThemePreview } from '@/components/club/gallery-previews'
import type { GalleryFrameStyle } from '@/data/artworks'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getI18n } from '@/lib/i18n/server'
import { fmt } from '@/lib/i18n/format'
import { canUseOwnClubGallery } from '@/lib/club-launch'
import { CLUB_MAX_OBRAS, optionState, roomCapacity, shopItems, statsSince, statsTotals, type ShopItem, type StatsRow } from '@/lib/club-editor'
import { CLUB_FRAME_STYLES, CLUB_GALLERY_THEMES, CLUB_ROOM_TEMPLATES, type ClubRoomTemplate, type GalleryCatalogKind } from '@/lib/gallery-catalog'
import { moderateBoardPiece, removeClubArtwork, saveGallerySettings, saveHangings, unlockItem } from './actions'
import { createAdminClient } from '@/lib/supabase/admin'
import { WALL_BUCKET } from '@/lib/collage-wall'
import { ClubArtworkUpload } from './club-artwork-upload'
import { HomePicker } from './home-picker'
import { EditorTabs } from './editor-tabs'

const inputClass = 'mt-1 w-full rounded-lg border-2 border-ink/15 bg-background px-3 py-2 text-sm'

// The member's editor. Private (reads the session), so it is not one of
// lib/static-pages.ts. A dashboard in tabs (./editor-tabs.tsx): a summary
// with what needs doing, then obras, settings, house, board and shop. Every
// option shows a drawing of how it looks (components/club/gallery-previews);
// options the member has not unlocked are shown locked, with their price in
// the shop.
export default async function EditGalleryPage({ searchParams }: { searchParams: Promise<{ error?: string; guardado?: string; desbloqueado?: string; subida?: string; quitada?: string; casa?: string; tablero?: string }> }) {
  if (!isSupabaseConfigured) redirect('/')
  const user = await getCurrentUser()
  if (!user) redirect('/mi-galeria')

  const { locale, m } = await getI18n()
  const t = m.club
  const e = t.editor
  const params = await searchParams
  const supabase = await createClient()

  const { data: gallery } = await supabase
    .from('club_galleries')
    .select('id, slug, title, statement, template_id, theme, default_frame_style, contact_whatsapp, contact_url, status, home_lat, home_lng')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!canUseOwnClubGallery(user.email, gallery?.status)) notFound()
  if (!gallery || gallery.status !== 'active') redirect('/mi-galeria')

  const since = statsSince(30)
  const [{ data: inventory }, { data: wallet }, { data: artworks }, { data: hangings }, { data: statsData }, { data: profile }] = await Promise.all([
    supabase.from('user_gallery_inventory').select('item_id'),
    supabase.from('club_wallets').select('balance').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('artworks')
      .select('id, title, image_url, is_club_only')
      .eq('profile_id', user.id)
      .is('archived_at', null)
      .is('duplicate_of', null)
      .order('created_at', { ascending: true }),
    supabase.from('club_gallery_hangings').select('slot, artwork_id').eq('gallery_id', gallery.id),
    supabase.rpc('club_gallery_stats', { since }),
    supabase.from('profiles').select('name, country_code').eq('id', user.id).maybeSingle(),
  ])
  // What visitors pasted on this member's board, waiting for them. Pieces
  // have no grants for members: read with the service role, scoped to the
  // gallery the session just proved is theirs.
  const admin = createAdminClient()
  const { data: boardPieces } = await admin
    .from('wall_pieces')
    .select('id, author_name, image_path, created_at')
    .eq('gallery_id', gallery.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(50)
  const boardPhoto = (path: string) => admin.storage.from(WALL_BUCKET).getPublicUrl(path).data.publicUrl

  const owned = new Set((inventory ?? []).map((row) => row.item_id))
  const balance = wallet?.balance ?? 0
  const slotOf = new Map((hangings ?? []).map((row) => [row.artwork_id, row.slot]))
  const capacity = roomCapacity(gallery.template_id as ClubRoomTemplate)
  const shop = shopItems(owned)
  const stats = (statsData ?? []) as StatsRow[]
  const totals = statsTotals(stats)
  const number = (value: number | string) => Number(value).toLocaleString(locale)

  const themeName = (id: string) => galleryThemes[id as GalleryTheme]?.name ?? id
  const itemName = (item: Pick<ShopItem, 'kind' | 'selectionId'>) => {
    if (item.kind === 'room') return e.rooms[item.selectionId as keyof typeof e.rooms]
    if (item.kind === 'frame') return e.frames[item.selectionId as keyof typeof e.frames]
    return themeName(item.selectionId)
  }
  const kindName: Partial<Record<GalleryCatalogKind, string>> = { room: e.fieldRoom, theme: e.fieldTheme, frame: e.fieldFrame }

  const error = params.error ? e.errors[params.error as keyof typeof e.errors] ?? e.errors.unavailable : undefined
  const notice = params.guardado ? e.saved : params.desbloqueado ? e.unlocked : params.subida ? e.uploaded : params.quitada ? e.removed : params.casa === '1' ? e.homeSaved : params.casa === '0' ? e.homeCleared : params.tablero ? e.boardDone : undefined
  const clubArtworks = (artworks ?? []).filter((artwork) => artwork.is_club_only)
  const needsProfile = !profile?.name?.trim() || !profile.country_code
  const metadataName = (user.user_metadata as { full_name?: string } | undefined)?.full_name?.trim() ?? ''

  const hungArtworks = (artworks ?? [])
    .filter((artwork) => slotOf.has(artwork.id))
    .sort((a, b) => (slotOf.get(a.id) ?? 0) - (slotOf.get(b.id) ?? 0))
  const imageOf = new Map((artworks ?? []).map((artwork) => [artwork.id, artwork.image_url]))
  const coverArt = hungArtworks[0]?.image_url ?? (artworks ?? [])[0]?.image_url ?? null
  const theme = gallery.theme as GalleryTheme
  const pending = (boardPieces ?? []).length
  const unhung = (artworks ?? []).length - hungArtworks.length
  const topWorks = [...stats].sort((a, b) => Number(b.view_seconds) - Number(a.view_seconds)).slice(0, 5)
  const topSeconds = Math.max(1, ...topWorks.map((row) => Number(row.view_seconds)))
  const todos = [
    pending > 0 && { href: '#tablero', icon: <StickyNote />, text: fmt(e.todoBoard, { n: pending }) },
    unhung > 0 && hungArtworks.length < capacity && { href: '#obras', icon: <Images />, text: fmt(e.todoUnhung, { n: unhung }) },
    gallery.home_lat === null && { href: '#casa', icon: <MapPin />, text: e.todoHome },
  ].filter(Boolean) as { href: string; icon: React.ReactNode; text: string }[]

  const summary = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi icon={<Clock />} label={e.colSeconds} value={number(totals.viewSeconds)} />
        <Kpi icon={<FileText />} label={e.colDetails} value={number(totals.detailsSeconds)} />
        <Kpi icon={<Stamp />} label={e.colStamps} value={number(totals.stamps)} />
        <Kpi icon={<Heart />} label={e.colLikes} value={number(totals.likes)} />
      </div>

      <Card icon={<Sparkles />} title={e.todoTitle}>
        {todos.length === 0 ? <p className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-collage-blue" />{e.todoNone}</p> : (
          <ul className="space-y-2">
            {todos.map((todo) => (
              <li key={todo.href}>
                <a href={todo.href} className="flex min-h-11 items-center gap-3 rounded-xl border-2 border-ink/10 px-4 text-sm font-semibold hover:border-ink/30 [&_svg]:h-4 [&_svg]:w-4">
                  {todo.icon}<span className="flex-1">{todo.text}</span><ChevronRight />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card icon={<Eye />} title={e.topWorks} body={e.statsBody}>
        {topWorks.length === 0 ? <p className="text-sm">{e.statsEmpty}</p> : (
          <>
            <ul className="space-y-3">
              {topWorks.map((row) => (
                <li key={row.artwork_id} className="flex items-center gap-3">
                  <Thumb src={imageOf.get(row.artwork_id)} size="h-12 w-12" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{row.title || '—'}</p>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-collage-blue" style={{ width: `${(Number(row.view_seconds) / topSeconds) * 100}%` }} />
                    </div>
                  </div>
                  <p className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground tabular-nums [&_svg]:h-3.5 [&_svg]:w-3.5">
                    <span className="flex items-center gap-1"><Clock />{number(row.view_seconds)}</span>
                    <span className="flex items-center gap-1"><Heart />{number(row.likes)}</span>
                  </p>
                </li>
              ))}
            </ul>
            <details className="mt-5 text-sm">
              <summary className="cursor-pointer font-semibold text-collage-blue">{e.statsTable}</summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[34rem] text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">{e.colWork}</th>
                      <th className="px-2 py-2 text-right font-semibold">{e.colViewers}</th>
                      <th className="px-2 py-2 text-right font-semibold">{e.colSeconds}</th>
                      <th className="px-2 py-2 text-right font-semibold">{e.colDetails}</th>
                      <th className="px-2 py-2 text-right font-semibold">{e.colStamps}</th>
                      <th className="py-2 pl-2 text-right font-semibold">{e.colLikes}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((row) => (
                      <tr key={row.artwork_id} className="border-b last:border-0">
                        <td className="max-w-[12rem] truncate py-2 pr-3 font-semibold">{row.slot}. {row.title || '—'}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{number(row.viewers)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{number(row.view_seconds)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{number(row.details_seconds)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{number(row.stamps)}</td>
                        <td className="py-2 pl-2 text-right tabular-nums">{number(row.likes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </Card>
    </div>
  )

  const works = (
    <div className="space-y-6">
      <Card icon={<Frame />} title={e.hangTitle} body={e.hangBody}>
        <div className="mb-5 flex items-center gap-4">
          <div className="w-28 shrink-0"><RoomPreview capacity={capacity} filled={hungArtworks.length} /></div>
          <p className="text-sm font-semibold">{fmt(e.hungCount, { n: hungArtworks.length, max: capacity })}</p>
        </div>
        {(artworks ?? []).length === 0 ? <p className="text-sm">{e.hangEmpty}</p> : (
          <>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(artworks ?? []).map((artwork) => {
                const slot = slotOf.get(artwork.id)
                return (
                  <li key={artwork.id} className={`flex flex-col rounded-xl border-2 p-2 ${slot ? 'border-ink/30' : 'border-dashed border-ink/15'}`}>
                    <div className="relative">
                      <Thumb src={artwork.image_url} size="aspect-square w-full" sizes="(min-width: 640px) 200px, 45vw" />
                      {slot && <span className="absolute top-1.5 left-1.5 rounded-full bg-ink px-2 py-0.5 text-xs font-bold text-white tabular-nums">{slot}</span>}
                    </div>
                    <label htmlFor={`slot-${artwork.id}`} className="mt-2 truncate text-sm font-semibold">{artwork.title || '—'}</label>
                    <select id={`slot-${artwork.id}`} form="hangings" name={`slot:${artwork.id}`} defaultValue={String(slot ?? '')} className="mt-1 min-h-11 w-full rounded-lg border-2 border-ink/15 bg-background px-2 text-sm">
                      <option value="">{e.hangNone}</option>
                      {Array.from({ length: capacity }, (_, index) => (
                        <option key={index + 1} value={index + 1}>{fmt(e.hangPosition, { n: index + 1 })}</option>
                      ))}
                    </select>
                    {artwork.is_club_only && (
                      <form action={removeClubArtwork} className="mt-2">
                        <input type="hidden" name="id" value={artwork.id} />
                        <SubmitButton variant="outline" size="sm" className="min-h-11 w-full"><Trash2 />{e.remove}</SubmitButton>
                      </form>
                    )}
                  </li>
                )
              })}
            </ul>
            {/* The selects above join this form through their form="hangings". */}
            <form id="hangings" action={saveHangings} className="mt-5">
              <SubmitButton className="min-h-11 w-full">{e.hangSave}</SubmitButton>
            </form>
          </>
        )}
      </Card>

      <Card icon={<Upload />} title={e.uploadTitle} body={fmt(e.uploadBody, { max: CLUB_MAX_OBRAS })}>
        <p className="mb-4 text-xs font-semibold text-muted-foreground">{clubArtworks.length} / {CLUB_MAX_OBRAS}</p>
        {clubArtworks.length < CLUB_MAX_OBRAS && (
          <ClubArtworkUpload
            userId={user.id}
            locale={locale}
            needsProfile={needsProfile}
            defaultName={profile?.name?.trim() || metadataName}
            texts={{
              image: e.uploadImage,
              title: m.onboarding.artworkTitle,
              technique: m.onboarding.technique,
              techniqueNone: m.onboarding.techniqueNone,
              techniques: m.common.techniques,
              optional: m.common.optional,
              profile: e.uploadProfile,
              name: m.onboarding.name,
              country: m.onboarding.country,
              upload: e.upload,
              uploading: e.uploading,
              errorImage: e.errors.image,
              errorUpload: e.errors.upload,
            }}
          />
        )}
      </Card>
    </div>
  )

  const settings = (
    <form action={saveGallerySettings} className="space-y-6">
      <Card icon={<Palette />} title={e.settingsTitle}>
        <div className="space-y-6">
          <Choice legend={e.fieldRoom} name="template_id" current={gallery.template_id} locked={e.locked}
            options={CLUB_ROOM_TEMPLATES.map((id) => ({ id, label: e.rooms[id], enabled: optionState('room', id, owned) === 'available', preview: <RoomPreview capacity={roomCapacity(id)} /> }))} />
          <Choice legend={e.fieldTheme} name="theme" current={gallery.theme} locked={e.locked}
            options={CLUB_GALLERY_THEMES.map((id) => ({ id, label: themeName(id), enabled: optionState('theme', id, owned) === 'available', preview: <ThemePreview theme={id} art={coverArt} /> }))} />
          <Choice legend={e.fieldFrame} name="default_frame_style" current={gallery.default_frame_style} locked={e.locked}
            options={CLUB_FRAME_STYLES.map((id) => ({ id, label: e.frames[id], enabled: optionState('frame', id, owned) === 'available', preview: <FramePreview style={id} theme={theme} art={coverArt} /> }))} />
        </div>
      </Card>

      <Card icon={<FileText />} title={e.textsTitle}>
        <div className="space-y-5">
          <div>
            <label htmlFor="title" className="text-sm font-semibold text-ink">{e.fieldTitle}</label>
            <input id="title" name="title" required maxLength={120} defaultValue={gallery.title} className={inputClass} />
          </div>
          <div>
            <label htmlFor="statement" className="text-sm font-semibold text-ink">{e.fieldStatement}</label>
            <textarea id="statement" name="statement" rows={5} maxLength={5000} defaultValue={gallery.statement ?? ''} className={inputClass} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="contact_whatsapp" className="text-sm font-semibold text-ink">{e.fieldWhatsapp}</label>
              <input id="contact_whatsapp" name="contact_whatsapp" type="tel" maxLength={40} defaultValue={gallery.contact_whatsapp ?? ''} className={inputClass} />
            </div>
            <div>
              <label htmlFor="contact_url" className="text-sm font-semibold text-ink">{e.fieldUrl}</label>
              <input id="contact_url" name="contact_url" type="url" maxLength={500} defaultValue={gallery.contact_url ?? ''} className={inputClass} />
            </div>
          </div>
        </div>
      </Card>
      <SubmitButton className="min-h-11 w-full">{e.save}</SubmitButton>
    </form>
  )

  const home = (
    <Card icon={<MapPin />} title={e.homeTitle} body={e.homeBody}>
      <HomePicker
        slug={gallery.slug}
        home={gallery.home_lat === null || gallery.home_lng === null ? null : [Number(gallery.home_lng), Number(gallery.home_lat)]}
        texts={{ enter: m.clubLanding.mapEnter, hint: m.clubLanding.mapHint, close: m.clubLanding.mapClose, yourHouse: e.homeYours }}
        labels={{ save: e.homeSave, clear: e.homeClear, none: e.homeNone }}
      />
    </Card>
  )

  const board = (
    <Card icon={<StickyNote />} title={e.boardTitle} body={e.boardBody}>
      {pending === 0 ? <p className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-collage-blue" />{e.boardEmpty}</p> : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(boardPieces ?? []).map((piece) => (
            <li key={piece.id} className="rounded-xl border-2 border-ink/10 p-2">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-[#cdb38c]">
                <Image src={boardPhoto(piece.image_path)} alt="" fill sizes="(min-width: 640px) 200px, 45vw" className="object-contain" />
              </div>
              <p className="mt-2 truncate text-sm font-semibold">{piece.author_name}</p>
              <div className="mt-2 flex gap-2">
                {(['approve', 'reject'] as const).map((decision) => (
                  <form key={decision} action={moderateBoardPiece} className="flex-1">
                    <input type="hidden" name="id" value={piece.id} />
                    <input type="hidden" name="decision" value={decision} />
                    <SubmitButton variant={decision === 'approve' ? 'default' : 'outline'} size="sm" aria-label={decision === 'approve' ? e.boardApprove : e.boardReject} title={decision === 'approve' ? e.boardApprove : e.boardReject} className="min-h-11 w-full">
                      {decision === 'approve' ? <Check /> : <X />}
                    </SubmitButton>
                  </form>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )

  const shopPanel = (
    <Card icon={<ShoppingBag />} title={e.shopTitle} body={e.shopBody}>
      {shop.length === 0 ? <p className="text-sm">{e.shopEmpty}</p> : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {shop.map((item) => {
            const missing = item.price - balance
            return (
              <li key={item.id} className="flex flex-col rounded-xl border-2 border-ink/10 p-3">
                {item.kind === 'theme' ? <ThemePreview theme={item.selectionId as GalleryTheme} art={coverArt} />
                  : item.kind === 'frame' ? <FramePreview style={item.selectionId as GalleryFrameStyle} theme={theme} art={coverArt} />
                  : <RoomPreview capacity={roomCapacity(item.selectionId as ClubRoomTemplate)} />}
                <p className="mt-3 text-xs text-muted-foreground">{kindName[item.kind]}</p>
                <p className="font-bold">{itemName(item)}</p>
                {missing > 0 && (
                  <div className="mt-2">
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-collage-yellow" style={{ width: `${Math.min(100, (balance / item.price) * 100)}%` }} /></div>
                    <p className="mt-1 text-xs text-muted-foreground">{fmt(e.missing, { missing: missing.toLocaleString(locale) })}</p>
                  </div>
                )}
                <form action={unlockItem} className="mt-auto pt-3">
                  <input type="hidden" name="item" value={item.id} />
                  <SubmitButton variant="outline" disabled={missing > 0} className="min-h-11 w-full"><Coins />{fmt(e.unlock, { price: item.price.toLocaleString(locale) })}</SubmitButton>
                </form>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )

  return (
    <main className="bg-grain min-h-screen px-5 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="overflow-hidden rounded-2xl bg-card sm:flex">
          <div className="flex h-36 items-center justify-center gap-2 p-4 sm:h-auto sm:w-56 sm:shrink-0" style={{ background: galleryThemes[theme]?.room.wall }}>
            {hungArtworks.length === 0 ? <Images className="h-10 w-10 text-ink/30" /> : hungArtworks.slice(0, 3).map((artwork) => (
              <div key={artwork.id} className="h-20 w-16 p-1 shadow-md" style={{ background: galleryThemes[theme]?.frame.outer }}>
                <Thumb src={artwork.image_url} size="h-full w-full" rounded="" />
              </div>
            ))}
          </div>
          <div className="flex-1 p-6">
            <Link href="/mi-galeria" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-ink"><ArrowLeft className="h-4 w-4" />{t.title}</Link>
            <h1 className="font-display text-3xl tracking-tight text-ink uppercase sm:text-4xl">{gallery.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
              <Chip icon={<Coins />}>{fmt(t.coins, { coins: balance.toLocaleString(locale) })}</Chip>
              <Chip icon={<Frame />}>{fmt(e.hungCount, { n: hungArtworks.length, max: capacity })}</Chip>
              <Chip icon={<Palette />}>{themeName(gallery.theme)}</Chip>
            </div>
            <Link href={`/club/${gallery.slug}`} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-bold text-white"><Eye className="h-4 w-4" />{t.viewGallery}</Link>
          </div>
        </header>

        {error && <p role="alert" className="rounded-lg bg-collage-red/10 px-3 py-2 text-center text-sm font-medium text-collage-red">{error}</p>}
        {notice && <p role="status" className="flex items-center justify-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm"><Check className="h-4 w-4" />{notice}</p>}

        <EditorTabs label={e.title} tabs={[
          { id: 'resumen', label: e.tabs.summary, icon: <LayoutDashboard />, content: summary },
          { id: 'obras', label: e.tabs.works, icon: <Images />, badge: unhung > 0 ? unhung : undefined, content: works },
          { id: 'ajustes', label: e.tabs.settings, icon: <Palette />, content: settings },
          { id: 'casa', label: e.tabs.home, icon: <MapPin />, content: home },
          { id: 'tablero', label: e.tabs.board, icon: <StickyNote />, badge: pending, content: board },
          { id: 'tienda', label: e.tabs.shop, icon: <ShoppingBag />, content: shopPanel },
        ]} />
      </div>
    </main>
  )
}

function Card({ icon, title, body, children }: { icon: React.ReactNode; title: string; body?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-5 sm:p-7">
      <h2 className="flex items-center gap-2 font-display text-xl uppercase sm:text-2xl [&_svg]:h-5 [&_svg]:w-5 [&_svg]:shrink-0">{icon}{title}</h2>
      {body && <p className="mt-2 text-sm text-muted-foreground">{body}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card p-4">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted text-ink [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      <p className="mt-3 font-display text-2xl tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}{children}</span>
}

function Thumb({ src, size, sizes = '64px', rounded = 'rounded-lg' }: { src?: string | null; size: string; sizes?: string; rounded?: string }) {
  return (
    <div className={`relative shrink-0 overflow-hidden bg-muted ${rounded} ${size}`}>
      {src && <Image src={src} alt="" fill sizes={sizes} className="object-cover" />}
    </div>
  )
}

function Choice({ legend, name, current, options, locked }: { legend: string; name: string; current: string; locked: string; options: { id: string; label: string; enabled: boolean; preview: React.ReactNode }[] }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-ink">{legend}</legend>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {options.map((option) => (
          <label key={option.id} className={`group relative flex flex-col rounded-xl border-2 p-2 text-sm has-[:checked]:border-collage-blue has-[:checked]:ring-2 has-[:checked]:ring-collage-blue/30 ${option.enabled ? 'cursor-pointer border-ink/15 hover:border-ink/40' : 'border-ink/10 text-muted-foreground'}`}>
            <input type="radio" name={name} value={option.id} defaultChecked={option.id === current} disabled={!option.enabled} className="sr-only" />
            <div className={option.enabled ? '' : 'opacity-50 grayscale'}>{option.preview}</div>
            <span className="mt-2 flex items-start gap-1.5 font-semibold leading-tight">
              <Check className="hidden h-4 w-4 shrink-0 text-collage-blue group-has-[:checked]:block" />
              {!option.enabled && <Lock className="h-3.5 w-3.5 shrink-0" />}
              {option.label}
            </span>
            {!option.enabled && <span className="text-xs">{locked}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
