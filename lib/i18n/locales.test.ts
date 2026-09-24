import { describe, expect, it } from 'vitest'
import { localeForCountry, localesFromAcceptLanguage, resolveLocale } from './locales'

describe('localesFromAcceptLanguage', () => {
  it('keeps supported languages in preference order', () => {
    expect(localesFromAcceptLanguage('it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7')).toEqual(['it', 'en'])
  })
  it('sorts by quality, not position', () => {
    expect(localesFromAcceptLanguage('en;q=0.5, fr-CH;q=0.9')).toEqual(['fr', 'en'])
  })
  it('skips languages we do not have and wildcards', () => {
    expect(localesFromAcceptLanguage('nl-NL, ja;q=0.9, *;q=0.1')).toEqual([])
    expect(localesFromAcceptLanguage(null)).toEqual([])
  })
})

describe('localeForCountry', () => {
  it('maps participant countries to their language', () => {
    expect(localeForCountry('AR')).toBe('es')
    expect(localeForCountry('br')).toBe('pt')
    expect(localeForCountry('IT')).toBe('it')
    expect(localeForCountry('FR')).toBe('fr')
    expect(localeForCountry('CH')).toBe('de')
    expect(localeForCountry('RU')).toBe('ru')
    expect(localeForCountry('PL')).toBe('pl')
    expect(localeForCountry('ID')).toBe('id')
  })
  it('falls back to English for other countries and nothing for no country', () => {
    expect(localeForCountry('JP')).toBe('en')
    expect(localeForCountry('')).toBeUndefined()
    expect(localeForCountry(null)).toBeUndefined()
  })
})

describe('resolveLocale', () => {
  it('lets an explicit choice win', () => {
    expect(resolveLocale({ cookie: 'pl', acceptLanguage: 'es-AR', country: 'AR' })).toBe('pl')
  })
  it('prefers the browser language over the country', () => {
    expect(resolveLocale({ acceptLanguage: 'es-419,es;q=0.9', country: 'IT' })).toBe('es')
  })
  it('uses the country when the browser asks for nothing we have', () => {
    expect(resolveLocale({ acceptLanguage: 'nl-NL', country: 'BE' })).toBe('fr')
  })
  it('ignores a tampered cookie and defaults to Spanish', () => {
    expect(resolveLocale({ cookie: 'xx' })).toBe('es')
  })
})
