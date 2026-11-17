import { describe, expect, it } from 'vitest'
import { MESSAGES } from '@/lib/i18n/messages'
import { artworkMetaDescription, nameWithCountry } from './artwork-description'

describe('artworkMetaDescription', () => {
  it('names the country when there is one', () => {
    expect(artworkMetaDescription(MESSAGES.es, 'es', { title: 'Mar', name: 'Ana', countryCode: 'AR' })).toBe('"Mar", de Ana (Argentina) — Mundial Internacional de Collage.')
  })

  it('drops the empty parentheses in every language while the country is missing', () => {
    for (const [locale, m] of Object.entries(MESSAGES)) {
      const text = artworkMetaDescription(m, locale, { title: 'Mar', name: 'Ana' })
      expect(text, locale).not.toMatch(/\(\s*\)/)
      expect(text, locale).toContain('Ana')
    }
  })
})

describe('nameWithCountry', () => {
  it('joins the country only when there is one', () => {
    expect(nameWithCountry('Ana', 'UY', 'es')).toBe('Ana · Uruguay')
    expect(nameWithCountry('Ana', undefined, 'es')).toBe('Ana')
  })
})
