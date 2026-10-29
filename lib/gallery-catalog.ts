import type { Fabric } from '@/components/gallery/world/people/fabrics'

export const CLUB_ROOM_TEMPLATES = ['cabinet', 'classic', 'double'] as const
export type ClubRoomTemplate = (typeof CLUB_ROOM_TEMPLATES)[number]

export const CLUB_GALLERY_THEMES = ['collage', 'garden', 'windows98', 'atelier', 'industrial', 'museum', 'alley'] as const
export type ClubGalleryTheme = (typeof CLUB_GALLERY_THEMES)[number]

export const CLUB_FRAME_STYLES = ['standard', 'wood', 'gold', 'black-mat', 'pinned'] as const
export type ClubFrameStyle = (typeof CLUB_FRAME_STYLES)[number]

export const AVATAR_ACCESSORIES = ['apron', 'beret', 'glasses', 'tote', 'coffee', 'scissors'] as const
export type AvatarAccessory = (typeof AVATAR_ACCESSORIES)[number]

export type GalleryCatalogKind = 'room' | 'theme' | 'frame' | 'avatar-accessory'
export type GalleryCatalogAvailability = 'included' | 'unlockable' | 'planned'

export type GalleryCatalogItem = {
  /** Stable inventory key persisted by user_gallery_inventory. */
  id: string
  kind: GalleryCatalogKind
  selectionId: string
  availability: GalleryCatalogAvailability
  /** Null means the product decision is not closed and the item must not be sold yet. */
  coinPrice: number | null
  stage: 1 | 2
}

const included = (kind: GalleryCatalogKind, selectionId: string): GalleryCatalogItem => ({
  id: `${kind}:${selectionId}`,
  kind,
  selectionId,
  availability: 'included',
  coinPrice: 0,
  stage: 1,
})

const unlockable = (kind: GalleryCatalogKind, selectionId: string, coinPrice: number): GalleryCatalogItem => ({
  id: `${kind}:${selectionId}`,
  kind,
  selectionId,
  availability: 'unlockable',
  coinPrice,
  stage: 1,
})

const planned = (kind: GalleryCatalogKind, selectionId: string, stage: 1 | 2): GalleryCatalogItem => ({
  id: `${kind}:${selectionId}`,
  kind,
  selectionId,
  availability: 'planned',
  coinPrice: null,
  stage,
})

/**
 * The Club catalogue's closed product decisions. Keep IDs and prices in sync
 * with the database allow-list used by spend_coins_on_item.
 *
 * Avatar accessories are renderable in stage 1, but remain planned rather
 * than purchasable because the product plan deliberately does not price them.
 */
export const GALLERY_CATALOG = [
  included('room', 'cabinet'),
  unlockable('room', 'classic', 2_500),
  unlockable('room', 'double', 5_000),

  included('theme', 'collage'),
  included('theme', 'garden'),
  included('theme', 'windows98'),
  unlockable('theme', 'atelier', 1_200),
  unlockable('theme', 'industrial', 1_200),
  unlockable('theme', 'museum', 1_200),
  unlockable('theme', 'alley', 1_200),

  included('frame', 'standard'),
  unlockable('frame', 'wood', 300),
  unlockable('frame', 'gold', 300),
  unlockable('frame', 'black-mat', 300),
  unlockable('frame', 'pinned', 300),

  planned('avatar-accessory', 'apron', 1),
  planned('avatar-accessory', 'beret', 1),
  planned('avatar-accessory', 'glasses', 1),
  planned('avatar-accessory', 'tote', 1),
  planned('avatar-accessory', 'coffee', 1),
  planned('avatar-accessory', 'scissors', 1),
] as const satisfies readonly GalleryCatalogItem[]

const itemById = new Map<string, GalleryCatalogItem>(GALLERY_CATALOG.map((item) => [item.id, item]))

export const PURCHASABLE_GALLERY_ITEMS = GALLERY_CATALOG.filter(
  (item): item is (typeof GALLERY_CATALOG)[number] & { availability: 'unlockable'; coinPrice: number } =>
    item.availability === 'unlockable' && item.coinPrice !== null && item.coinPrice > 0,
)

export function galleryCatalogItem(itemId: string) {
  return itemById.get(itemId)
}

export function inventoryItemFor(kind: GalleryCatalogKind, selectionId: string) {
  const item = galleryCatalogItem(`${kind}:${selectionId}`)
  if (!item) return undefined
  return item.availability === 'included' ? null : item
}

export const AVATAR_OUTFIT_FABRICS = [
  'jersey', 'knit', 'satin', 'poplin', 'gabardine', 'denim', 'twill', 'crepe', 'leather', 'canvas', 'rubber',
] as const satisfies readonly Fabric[]

