import { describe, expect, it } from 'vitest'
import { countryCodeToFlag, countryCodeToName, getAllCountryCodes } from './participants'

describe('countryCodeToFlag', () => {
  it('converts a 2-letter ISO code into its flag emoji', () => {
    expect(countryCodeToFlag('AR')).toBe('🇦🇷')
    expect(countryCodeToFlag('us')).toBe('🇺🇸')
  })
})

describe('countryCodeToName', () => {
  it('resolves a known code to its Spanish display name', () => {
    expect(countryCodeToName('AR')).toBe('Argentina')
    expect(countryCodeToName('mx')).toBe('México')
  })

  it('resolves a reserved/user-assigned code via ICU rather than throwing', () => {
    // 'ZZ' is well-formed (2 letters) so Intl.DisplayNames resolves it to
    // ICU's placeholder name instead of throwing or falling back — it's the
    // *malformed* codes below that need the try/catch.
    expect(countryCodeToName('ZZ')).toBe('Región desconocida')
  })

  // Intl.DisplayNames.of() *throws* a RangeError for a code that isn't a
  // well-formed 2-letter/3-digit region subtag (empty, one letter, three
  // letters) — it doesn't just return undefined. Without a try/catch this
  // takes down the whole page render (every /obras/[slug], /edicion-2026,
  // /participantes call goes through this). country_code is normally
  // constrained by the onboarding form's <select>, but this is the only
  // thing stopping a stray value from crashing instead of just rendering
  // the raw code.
  it('does not throw for a malformed code and falls back to the raw value', () => {
    expect(() => countryCodeToName('')).not.toThrow()
    expect(countryCodeToName('')).toBe('')
    expect(() => countryCodeToName('A')).not.toThrow()
    expect(countryCodeToName('A')).toBe('A')
    expect(() => countryCodeToName('ARG')).not.toThrow()
    expect(countryCodeToName('ARG')).toBe('ARG')
  })
})

describe('getAllCountryCodes', () => {
  it('returns a sorted, non-empty list of unique codes', () => {
    const codes = getAllCountryCodes()
    expect(codes.length).toBeGreaterThan(100)
    expect(codes).toEqual([...codes].sort())
    expect(new Set(codes).size).toBe(codes.length)
  })
})
