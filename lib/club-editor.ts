import { clubGallerySlots } from '@/data/artworks'
import {
  CLUB_FRAME_STYLES,
  CLUB_GALLERY_THEMES,
  CLUB_ROOM_TEMPLATES,
  PURCHASABLE_GALLERY_ITEMS,
  inventoryItemFor,
  type ClubFrameStyle,
  type ClubGalleryTheme,
  type ClubRoomTemplate,
  type GalleryCatalogKind,
} from '@/lib/gallery-catalog'

// What the Club editor (/mi-galeria/editar) lets an artist change, and the
// checks that run before anything is saved. The database repeats them
// (validate_club_gallery_inventory, validate_club_gallery_hanging): these
// give a clear answer first, those are the ones that cannot be skipped.

/** How many obras each room takes: the slots the 3D room draws. */
export function roomCapacity(template: ClubRoomTemplate): number {
  return clubGallerySlots[template].length
}

export type OptionState = 'available' | 'locked'

/** An option is available when it comes with the Club or the artist already bought it. */
export function optionState(kind: GalleryCatalogKind, selectionId: string, owned: ReadonlySet<string>): OptionState {
  const item = inventoryItemFor(kind, selectionId)
  if (item === undefined) return 'locked'
  return item === null || owned.has(item.id) ? 'available' : 'locked'
}

export type ShopItem = { id: string; kind: GalleryCatalogKind; selectionId: string; price: number }

/** What the artist can still unlock, cheapest first, grouped by the order of the catalogue. */
export function shopItems(owned: ReadonlySet<string>): ShopItem[] {
  return PURCHASABLE_GALLERY_ITEMS
    .filter((item) => !owned.has(item.id))
    .map((item) => ({ id: item.id, kind: item.kind, selectionId: item.selectionId, price: item.coinPrice }))
}

export type GallerySettings = {
  title: string
  statement: string | null
  template_id: ClubRoomTemplate
  theme: ClubGalleryTheme
  default_frame_style: ClubFrameStyle
  contact_whatsapp: string | null
  contact_url: string | null
}

export type EditorError = 'invalid' | 'locked'

const text = (form: FormData, field: string) => String(form.get(field) ?? '').trim()
const oneOf = <T extends string>(values: readonly T[], value: string): T | null => (values as readonly string[]).includes(value) ? (value as T) : null

/** A web address the visitor will be sent to: http or https only. */
function webAddress(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

export function parseGallerySettings(form: FormData, owned: ReadonlySet<string>): { ok: true; settings: GallerySettings } | { ok: false; error: EditorError } {
  const title = text(form, 'title')
  const statement = text(form, 'statement')
  const template = oneOf(CLUB_ROOM_TEMPLATES, text(form, 'template_id'))
  const theme = oneOf(CLUB_GALLERY_THEMES, text(form, 'theme'))
  const frame = oneOf(CLUB_FRAME_STYLES, text(form, 'default_frame_style'))
  const whatsapp = text(form, 'contact_whatsapp')
  const url = text(form, 'contact_url')

  if (title.length < 1 || title.length > 120 || statement.length > 5000 || !template || !theme || !frame) return { ok: false, error: 'invalid' }
  if (whatsapp && !/^[+\d\s()-]{6,40}$/.test(whatsapp)) return { ok: false, error: 'invalid' }
  const contactUrl = url ? webAddress(url) : null
  if (url && (!contactUrl || contactUrl.length > 500)) return { ok: false, error: 'invalid' }

  if (
    optionState('room', template, owned) === 'locked' ||
    optionState('theme', theme, owned) === 'locked' ||
    optionState('frame', frame, owned) === 'locked'
  ) return { ok: false, error: 'locked' }

  return {
    ok: true,
    settings: {
      title,
      statement: statement || null,
      template_id: template,
      theme,
      default_frame_style: frame,
      contact_whatsapp: whatsapp || null,
      contact_url: contactUrl,
    },
  }
}

export type HangingRow = { slot: number; artwork_id: string; frame_style: string }

/**
 * The form has one `slot:<artwork id>` field per obra of the artist: empty
 * for an obra that stays out, a position from 1 to the room's capacity for
 * one that hangs. Two obras in one position, a position outside the room or
 * an obra that is not the artist's make the whole save invalid.
 */
export function parseHangings(form: FormData, capacity: number, ownedArtworkIds: ReadonlySet<string>): { ok: true; rows: HangingRow[] } | { ok: false; error: 'invalid' } {
  const rows: HangingRow[] = []
  const taken = new Set<number>()
  for (const [field, raw] of form.entries()) {
    if (!field.startsWith('slot:')) continue
    const value = String(raw).trim()
    if (!value) continue
    const artworkId = field.slice('slot:'.length)
    const slot = Number(value)
    if (!ownedArtworkIds.has(artworkId) || !Number.isInteger(slot) || slot < 1 || slot > capacity || taken.has(slot)) return { ok: false, error: 'invalid' }
    taken.add(slot)
    rows.push({ slot, artwork_id: artworkId, frame_style: '' })
  }
  return { ok: true, rows: rows.toSorted((left, right) => left.slot - right.slot) }
}

/** A smaller room cannot be picked while obras hang in positions it does not have. */
export function fitsRoom(hungSlots: readonly number[], capacity: number): boolean {
  return hungSlots.every((slot) => slot <= capacity)
}
