import { describe, expect, it } from 'vitest'
import { slugify } from './slug'

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
