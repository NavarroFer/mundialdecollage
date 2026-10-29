import { describe, expect, it } from 'vitest'
import { FREE_GALLERY_THEMES, GALLERY_THEMES, UNLOCKABLE_GALLERY_THEMES, galleryThemes } from './themes'

describe('galleryThemes', () => {
  it('keeps the three included themes and four Club unlocks distinct', () => {
    expect(FREE_GALLERY_THEMES).toEqual(['collage', 'windows98', 'garden'])
    expect(UNLOCKABLE_GALLERY_THEMES).toEqual(['atelier', 'industrial', 'museum', 'alley'])
    expect(GALLERY_THEMES).toHaveLength(7)
  })

  it('provides a complete rendering palette for every theme', () => {
    for (const id of GALLERY_THEMES) {
      const theme = galleryThemes[id]
      expect(theme.id).toBe(id)
      expect(theme.room.wall).toMatch(/^#[0-9a-f]{6}$/i)
      expect(theme.room.floor).toMatch(/^#[0-9a-f]{6}$/i)
      expect(theme.frame.outer).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('uses procedural parquet-compatible floors for atelier and museum', () => {
    expect(galleryThemes.atelier.architecture?.planks).toBe(true)
    expect(galleryThemes.museum.architecture?.planks).toBe(true)
    expect(galleryThemes.museum.architecture?.skylight).toBe(true)
  })
})
