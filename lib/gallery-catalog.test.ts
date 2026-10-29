import { describe, expect, it } from 'vitest'
import {
  AVATAR_ACCESSORIES,
  CLUB_FRAME_STYLES,
  CLUB_GALLERY_THEMES,
  CLUB_ROOM_TEMPLATES,
  GALLERY_CATALOG,
  PURCHASABLE_GALLERY_ITEMS,
  galleryCatalogItem,
  inventoryItemFor,
} from './gallery-catalog'

describe('Club gallery catalogue', () => {
  it('covers every selectable room, theme, frame and accessory exactly once', () => {
    const expected = [
      ...CLUB_ROOM_TEMPLATES.map((id) => `room:${id}`),
      ...CLUB_GALLERY_THEMES.map((id) => `theme:${id}`),
      ...CLUB_FRAME_STYLES.map((id) => `frame:${id}`),
      ...AVATAR_ACCESSORIES.map((id) => `avatar-accessory:${id}`),
    ]
    expect(GALLERY_CATALOG.map(({ id }) => id).sort()).toEqual(expected.sort())
  })

  it('uses the prices closed in the product plan', () => {
    expect(galleryCatalogItem('room:classic')?.coinPrice).toBe(2_500)
    expect(galleryCatalogItem('room:double')?.coinPrice).toBe(5_000)
    expect(galleryCatalogItem('theme:museum')?.coinPrice).toBe(1_200)
    expect(galleryCatalogItem('frame:pinned')?.coinPrice).toBe(300)
  })

  it('never exposes an unpriced or included item as purchasable', () => {
    expect(PURCHASABLE_GALLERY_ITEMS.every(({ availability, coinPrice }) => availability === 'unlockable' && coinPrice > 0)).toBe(true)
    expect(PURCHASABLE_GALLERY_ITEMS.some(({ kind }) => kind === 'avatar-accessory')).toBe(false)
  })

  it('requires inventory only for non-included selections', () => {
    expect(inventoryItemFor('theme', 'collage')).toBeNull()
    expect(inventoryItemFor('theme', 'atelier')?.id).toBe('theme:atelier')
    expect(inventoryItemFor('theme', 'unknown')).toBeUndefined()
  })
})
