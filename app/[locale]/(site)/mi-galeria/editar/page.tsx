import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { SubmitButton } from '@/components/admin/submit-button'
import { galleryThemes, type GalleryTheme } from '@/components/gallery/themes'
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

const inputClass = 'mt-1 w-full rounded-lg border-2 border-ink/15 bg-background px-3 py-2 text-sm'

// The member's editor. Private (reads the session), so it is not one of
// lib/static-pages.ts. Options the member has not unlocked are shown in the
// shop with their price; the settings form only offers what they can use.
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

  return (
    <main className="bg-grain min-h-screen px-5 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <header className="text-center">
          <h1 className="font-display text-3xl tracking-tight text-ink uppercase sm:text-4xl">{e.title}</h1>
          <p className="mt-3 text-muted-foreground">{gallery.title} · {fmt(t.coins, { coins: balance.toLocaleString(locale) })}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm">
            <Link href={`/club/${gallery.slug}`} className="inline-flex min-h-11 items-center underline">{t.viewGallery}</Link>
            <Link href="/mi-galeria" className="inline-flex min-h-11 items-center underline">{t.title}</Link>
          </div>
        </header>

        {error && <p role="alert" className="rounded-lg bg-collage-red/10 px-3 py-2 text-center text-sm font-medium text-collage-red">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-muted px-3 py-2 text-center text-sm">{notice}</p>}

        <section className="rounded-2xl bg-card p-6 sm:p-8">
          <h2 className="font-display text-2xl uppercase">{e.statsTitle}</h2>
          <p className="my-3 text-sm text-muted-foreground">{e.statsBody}</p>
          {stats.length === 0 ? (
            <p className="text-sm">{e.statsEmpty}</p>
          ) : (
            <div className="overflow-x-auto">
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
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td className="py-2 pr-3">{e.statsTotal}</td>
                    <td className="px-2 py-2 text-right">—</td>
                    <td className="px-2 py-2 text-right tabular-nums">{number(totals.viewSeconds)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{number(totals.detailsSeconds)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{number(totals.stamps)}</td>
                    <td className="py-2 pl-2 text-right tabular-nums">{number(totals.likes)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-card p-6 sm:p-8">
          <h2 className="font-display text-2xl uppercase">{e.settingsTitle}</h2>
          <form action={saveGallerySettings} className="mt-4 space-y-5">
            <div>
              <label htmlFor="title" className="text-sm font-semibold text-ink">{e.fieldTitle}</label>
              <input id="title" name="title" required maxLength={120} defaultValue={gallery.title} className={inputClass} />
            </div>
            <div>
              <label htmlFor="statement" className="text-sm font-semibold text-ink">{e.fieldStatement}</label>
              <textarea id="statement" name="statement" rows={5} maxLength={5000} defaultValue={gallery.statement ?? ''} className={inputClass} />
            </div>

            <Choice legend={e.fieldRoom} name="template_id" current={gallery.template_id}
              options={CLUB_ROOM_TEMPLATES.map((id) => ({ id, label: e.rooms[id], enabled: optionState('room', id, owned) === 'available' }))} />
            <Choice legend={e.fieldTheme} name="theme" current={gallery.theme}
              options={CLUB_GALLERY_THEMES.map((id) => ({ id, label: themeName(id), enabled: optionState('theme', id, owned) === 'available' }))} />
            <Choice legend={e.fieldFrame} name="default_frame_style" current={gallery.default_frame_style}
              options={CLUB_FRAME_STYLES.map((id) => ({ id, label: e.frames[id], enabled: optionState('frame', id, owned) === 'available' }))} />

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
            <SubmitButton className="min-h-11 w-full">{e.save}</SubmitButton>
          </form>
        </section>

        <section id="casa" className="scroll-mt-6 rounded-2xl bg-card p-6 sm:p-8">
          <h2 className="font-display text-2xl uppercase">{e.homeTitle}</h2>
          <p className="my-3 text-sm text-muted-foreground">{e.homeBody}</p>
          <HomePicker
            slug={gallery.slug}
            home={gallery.home_lat === null || gallery.home_lng === null ? null : [Number(gallery.home_lng), Number(gallery.home_lat)]}
            texts={{ enter: m.clubLanding.mapEnter, hint: m.clubLanding.mapHint, close: m.clubLanding.mapClose, yourHouse: e.homeYours }}
            labels={{ save: e.homeSave, clear: e.homeClear, none: e.homeNone }}
          />
        </section>

        <section id="tablero" className="scroll-mt-6 rounded-2xl bg-card p-6 sm:p-8">
          <h2 className="font-display text-2xl uppercase">{e.boardTitle}</h2>
          <p className="my-3 text-sm text-muted-foreground">{e.boardBody}</p>
          {(boardPieces ?? []).length === 0 ? (
            <p className="text-sm">{e.boardEmpty}</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {(boardPieces ?? []).map((piece) => (
                <li key={piece.id} className="rounded-xl border p-3">
                  <div className="relative aspect-square overflow-hidden rounded-lg bg-[#cdb38c]">
                    <Image src={boardPhoto(piece.image_path)} alt="" fill sizes="(min-width: 640px) 300px, 90vw" className="object-contain" />
                  </div>
                  <p className="mt-2 truncate text-sm font-semibold">{piece.author_name}</p>
                  <div className="mt-2 flex gap-2">
                    {(['approve', 'reject'] as const).map((decision) => (
                      <form key={decision} action={moderateBoardPiece} className="flex-1">
                        <input type="hidden" name="id" value={piece.id} />
                        <input type="hidden" name="decision" value={decision} />
                        <SubmitButton variant={decision === 'approve' ? 'default' : 'outline'} className="min-h-11 w-full">
                          {decision === 'approve' ? e.boardApprove : e.boardReject}
                        </SubmitButton>
                      </form>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="obras" className="scroll-mt-6 rounded-2xl bg-card p-6 sm:p-8">
          <h2 className="font-display text-2xl uppercase">{e.uploadTitle}</h2>
          <p className="my-3 text-sm text-muted-foreground">{fmt(e.uploadBody, { max: CLUB_MAX_OBRAS })}</p>
          {clubArtworks.length > 0 && (
            <ul className="mb-6 space-y-3">
              {clubArtworks.map((artwork) => (
                <li key={artwork.id} className="flex items-center gap-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {artwork.image_url && <Image src={artwork.image_url} alt="" fill sizes="64px" className="object-contain" />}
                  </div>
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">{artwork.title || '—'}</p>
                  <form action={removeClubArtwork}>
                    <input type="hidden" name="id" value={artwork.id} />
                    <SubmitButton variant="outline" className="min-h-11">{e.remove}</SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
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
        </section>

        <section className="rounded-2xl bg-card p-6 sm:p-8">
          <h2 className="font-display text-2xl uppercase">{e.hangTitle}</h2>
          <p className="my-3 text-sm text-muted-foreground">{e.hangBody}</p>
          {(artworks ?? []).length === 0 ? (
            <p className="text-sm">{e.hangEmpty}</p>
          ) : (
            <form action={saveHangings} className="space-y-4">
              <ul className="space-y-3">
                {(artworks ?? []).map((artwork) => (
                  <li key={artwork.id} className="flex items-center gap-4">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {artwork.image_url && <Image src={artwork.image_url} alt="" fill sizes="64px" className="object-contain" />}
                    </div>
                    <label htmlFor={`slot-${artwork.id}`} className="min-w-0 flex-1 truncate text-sm font-semibold">{artwork.title || '—'}</label>
                    <select id={`slot-${artwork.id}`} name={`slot:${artwork.id}`} defaultValue={String(slotOf.get(artwork.id) ?? '')} className="min-h-11 rounded-lg border-2 border-ink/15 bg-background px-2 text-sm">
                      <option value="">{e.hangNone}</option>
                      {Array.from({ length: capacity }, (_, index) => (
                        <option key={index + 1} value={index + 1}>{fmt(e.hangPosition, { n: index + 1 })}</option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
              <SubmitButton className="min-h-11 w-full">{e.hangSave}</SubmitButton>
            </form>
          )}
        </section>

        <section className="rounded-2xl bg-card p-6 sm:p-8">
          <h2 className="font-display text-2xl uppercase">{e.shopTitle}</h2>
          <p className="my-3 text-sm text-muted-foreground">{e.shopBody}</p>
          {shop.length === 0 ? (
            <p className="text-sm">{e.shopEmpty}</p>
          ) : (
            <ul className="space-y-3">
              {shop.map((item) => {
                const missing = item.price - balance
                return (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
                    <p className="text-sm"><span className="text-muted-foreground">{kindName[item.kind]} · </span><span className="font-bold">{itemName(item)}</span></p>
                    <form action={unlockItem} className="flex items-center gap-3">
                      <input type="hidden" name="item" value={item.id} />
                      {missing > 0 && <span className="text-xs text-muted-foreground">{fmt(e.missing, { missing: missing.toLocaleString(locale) })}</span>}
                      <SubmitButton variant="outline" disabled={missing > 0} className="min-h-11">{fmt(e.unlock, { price: item.price.toLocaleString(locale) })}</SubmitButton>
                    </form>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}

function Choice({ legend, name, current, options }: { legend: string; name: string; current: string; options: { id: string; label: string; enabled: boolean }[] }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-ink">{legend}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label key={option.id} className={`flex min-h-11 items-center gap-2 rounded-lg border-2 px-3 text-sm ${option.enabled ? 'cursor-pointer border-ink/15' : 'border-ink/10 text-muted-foreground opacity-60'}`}>
            <input type="radio" name={name} value={option.id} defaultChecked={option.id === current} disabled={!option.enabled} />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
