import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { SubmitButton } from '@/components/admin/submit-button'
import { galleryThemes, type GalleryTheme } from '@/components/gallery/themes'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getI18n } from '@/lib/i18n/server'
import { fmt } from '@/lib/i18n/format'
import { canUseClub } from '@/lib/club-launch'
import { optionState, roomCapacity, shopItems, type ShopItem } from '@/lib/club-editor'
import { CLUB_FRAME_STYLES, CLUB_GALLERY_THEMES, CLUB_ROOM_TEMPLATES, type ClubRoomTemplate, type GalleryCatalogKind } from '@/lib/gallery-catalog'
import { saveGallerySettings, saveHangings, unlockItem } from './actions'

const inputClass = 'mt-1 w-full rounded-lg border-2 border-ink/15 bg-background px-3 py-2 text-sm'

// The member's editor. Private (reads the session), so it is not one of
// lib/static-pages.ts. Options the member has not unlocked are shown in the
// shop with their price; the settings form only offers what they can use.
export default async function EditGalleryPage({ searchParams }: { searchParams: Promise<{ error?: string; guardado?: string; desbloqueado?: string }> }) {
  if (!isSupabaseConfigured) redirect('/')
  const user = await getCurrentUser()
  if (!user) redirect('/mi-galeria')
  if (!canUseClub(user.email)) notFound()

  const { locale, m } = await getI18n()
  const t = m.club
  const e = t.editor
  const params = await searchParams
  const supabase = await createClient()

  const { data: gallery } = await supabase
    .from('club_galleries')
    .select('id, slug, title, statement, template_id, theme, default_frame_style, contact_whatsapp, contact_url, status')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!gallery || gallery.status !== 'active') redirect('/mi-galeria')

  const [{ data: inventory }, { data: wallet }, { data: artworks }, { data: hangings }] = await Promise.all([
    supabase.from('user_gallery_inventory').select('item_id'),
    supabase.from('club_wallets').select('balance').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('artworks')
      .select('id, title, image_url')
      .eq('profile_id', user.id)
      .is('archived_at', null)
      .is('duplicate_of', null)
      .order('created_at', { ascending: true }),
    supabase.from('club_gallery_hangings').select('slot, artwork_id').eq('gallery_id', gallery.id),
  ])

  const owned = new Set((inventory ?? []).map((row) => row.item_id))
  const balance = wallet?.balance ?? 0
  const slotOf = new Map((hangings ?? []).map((row) => [row.artwork_id, row.slot]))
  const capacity = roomCapacity(gallery.template_id as ClubRoomTemplate)
  const shop = shopItems(owned)

  const themeName = (id: string) => galleryThemes[id as GalleryTheme]?.name ?? id
  const itemName = (item: Pick<ShopItem, 'kind' | 'selectionId'>) => {
    if (item.kind === 'room') return e.rooms[item.selectionId as keyof typeof e.rooms]
    if (item.kind === 'frame') return e.frames[item.selectionId as keyof typeof e.frames]
    return themeName(item.selectionId)
  }
  const kindName: Partial<Record<GalleryCatalogKind, string>> = { room: e.fieldRoom, theme: e.fieldTheme, frame: e.fieldFrame }

  const error = params.error ? e.errors[params.error as keyof typeof e.errors] ?? e.errors.unavailable : undefined
  const notice = params.guardado ? e.saved : params.desbloqueado ? e.unlocked : undefined

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
