import { describe, expect, it } from 'vitest'
import { buildCountryBreakdown } from './country-breakdown'

const registro = [
  { country: 'Argentina', count: 130 },
  { country: 'México', count: 23 },
  { country: 'Sin país registrado', count: 2 },
]

describe('buildCountryBreakdown', () => {
  it("keeps Registro's curated counts for the countries it lists", () => {
    const breakdown = buildCountryBreakdown(registro, ['AR', 'AR', 'MX'])
    expect(breakdown).toEqual([
      { country: 'Argentina', countryCode: 'AR', count: 130 },
      { country: 'México', countryCode: 'MX', count: 23 },
      { country: 'Sin país registrado', countryCode: undefined, count: 2 },
    ])
  })

  it('adds countries that have published obras but are missing from Registro', () => {
    const breakdown = buildCountryBreakdown(registro, ['AR', 'AU', 'pa', 'PA', 'MT'])
    expect(breakdown).toContainEqual({ country: 'Australia', countryCode: 'AU', count: 1 })
    expect(breakdown).toContainEqual({ country: 'Panamá', countryCode: 'PA', count: 2 })
    expect(breakdown).toContainEqual({ country: 'Malta', countryCode: 'MT', count: 1 })
  })

  it('ranks by count, then alphabetically', () => {
    const breakdown = buildCountryBreakdown(registro, ['PA', 'AU', 'PA', 'PA'])
    expect(breakdown.map((b) => b.country)).toEqual([
      'Argentina',
      'México',
      'Panamá',
      'Sin país registrado',
      'Australia',
    ])
  })
})
