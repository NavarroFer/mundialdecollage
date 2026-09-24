import { describe, expect, it } from 'vitest'
import { normalizeArtistName } from './name-format'

describe('normalizeArtistName', () => {
  it('title-cases an all-caps name', () => {
    expect(normalizeArtistName('JUAN PEREZ')).toBe('Juan Perez')
  })

  it('title-cases an all-lowercase name', () => {
    expect(normalizeArtistName('juan perez')).toBe('Juan Perez')
  })

  it('title-cases randomly-cased input', () => {
    expect(normalizeArtistName('JuAn PErez')).toBe('Juan Perez')
  })

  it('capitalizes a nickname in parentheses', () => {
    expect(normalizeArtistName('Roxana Bidoglio (robi)')).toBe('Roxana Bidoglio (Robi)')
    expect(normalizeArtistName('lilian sofia fuentes (bruma)')).toBe('Lilian Sofia Fuentes (Bruma)')
  })

  it('preserves accents while fixing case', () => {
    expect(normalizeArtistName('SOFÍA RAMÍREZ')).toBe('Sofía Ramírez')
  })

  it('keeps connector particles lowercase mid-name', () => {
    expect(normalizeArtistName('maria de la cruz')).toBe('Maria de la Cruz')
  })

  it('capitalizes a particle when it opens the name', () => {
    expect(normalizeArtistName('de la cruz maria')).toBe('De la Cruz Maria')
  })

  it('capitalizes both sides of a hyphen', () => {
    expect(normalizeArtistName('JEAN-PIERRE dupont')).toBe('Jean-Pierre Dupont')
  })

  it('capitalizes after an apostrophe', () => {
    expect(normalizeArtistName("o'brien")).toBe("O'Brien")
  })

  it('collapses repeated/leading/trailing whitespace', () => {
    expect(normalizeArtistName('  juan   perez  ')).toBe('Juan Perez')
  })

  it('is idempotent on an already-clean name', () => {
    expect(normalizeArtistName('Juan Pérez')).toBe('Juan Pérez')
  })

  it('returns an empty string for empty/blank input', () => {
    expect(normalizeArtistName('')).toBe('')
    expect(normalizeArtistName('   ')).toBe('')
  })

  it('leaves non-Latin scripts as-is aside from whitespace', () => {
    expect(normalizeArtistName('田中  太郎')).toBe('田中 太郎')
  })
})
