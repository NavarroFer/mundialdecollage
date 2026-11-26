import { describe, expect, it } from 'vitest'
import { boundedSlug, MAX_ARTWORK_SLUG_LENGTH, slugify } from './slug'

describe('slugify', () => {
  it('lowercases and dashes plain ascii', () => {
    expect(slugify('Mateo Alviani')).toBe('mateo-alviani')
  })

  it('strips accents instead of dropping the letter', () => {
    expect(slugify('Sofía Ramírez')).toBe('sofia-ramirez')
  })

  it('collapses punctuation and repeated separators into single dashes', () => {
    expect(slugify("Art's  Piece: \"Untitled\"!!")).toBe('art-s-piece-untitled')
  })

  it('trims leading/trailing dashes', () => {
    expect(slugify('  -Hola-  ')).toBe('hola')
  })

  // This is the case app/onboarding/actions.ts has to guard against: a name
  // and title with no Latin characters at all (real in an *international*
  // contest — Japanese, Arabic, Cyrillic, ...) strips to nothing, which
  // /obras/[slug] can't route to. slugify() itself is expected to return ''
  // here; the caller is responsible for falling back to something else.
  it('returns an empty string for input with no Latin/ASCII characters', () => {
    expect(slugify('田中太郎')).toBe('')
    expect(slugify('日本語のタイトル')).toBe('')
  })

  it('returns an empty string for purely symbolic input', () => {
    expect(slugify('!!!')).toBe('')
  })
})

describe('boundedSlug', () => {
  it('leaves a normal slug as slugify makes it', () => {
    expect(boundedSlug('Sofía Ramírez-Mar de papel')).toBe('sofia-ramirez-mar-de-papel')
  })

  it('cuts a title pasted with its whole description at the last whole word', () => {
    const title = 'Lucrecia Adela-La geisha y el cisne. Collage 2026. Descripción técnica: collage sobre cartón gris, estilo reinterpretación tridimensional, dimensiones 50x40cm'
    const slug = boundedSlug(title)
    expect(slug.length).toBeLessThanOrEqual(MAX_ARTWORK_SLUG_LENGTH)
    expect(slug.startsWith('lucrecia-adela-la-geisha-y-el-cisne-collage-2026')).toBe(true)
    expect(title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')).toContain(slug)
    expect(slug.endsWith('-')).toBe(false)
  })

  it('cuts a single endless word at the limit', () => {
    expect(boundedSlug('a'.repeat(300))).toBe('a'.repeat(MAX_ARTWORK_SLUG_LENGTH))
  })

  it('still returns an empty string when nothing is Latin, for the caller to fall back', () => {
    expect(boundedSlug('日本語のタイトル')).toBe('')
  })
})
