import { describe, expect, it } from 'vitest'
import { clubHouseFromRow, jitterHome, parseHome } from './club-map'

const form = (fields: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

describe('parseHome', () => {
  it('rounds the clicked point to a tenth of a degree', () => {
    expect(parseHome(form({ home_lat: '-38.00523', home_lng: '-57.55741' }))).toEqual({ lat: -38, lng: -57.6 })
  })
  it('reads an empty form as no house', () => {
    expect(parseHome(form({ home_lat: '', home_lng: '' }))).toBeNull()
  })
  it.each([
    [{ home_lat: '-38', home_lng: '' }],
    [{ home_lat: 'abc', home_lng: '1' }],
    [{ home_lat: '91', home_lng: '0' }],
    [{ home_lat: '0', home_lng: '-181' }],
  ])('refuses %o', (fields) => {
    expect(parseHome(form(fields))).toBeUndefined()
  })
})

describe('jitterHome', () => {
  it('moves a house a little, always the same way', () => {
    const [lng, lat] = jitterHome('ana-1', -38, -57.6)
    expect(Math.abs(lng + 57.6)).toBeLessThanOrEqual(0.04)
    expect(Math.abs(lat + 38)).toBeLessThanOrEqual(0.04)
    expect(jitterHome('ana-1', -38, -57.6)).toEqual([lng, lat])
  })
  it('separates two neighbours in the same rounded point', () => {
    expect(jitterHome('ana-1', -38, -57.6)).not.toEqual(jitterHome('beto-2', -38, -57.6))
  })
})

describe('clubHouseFromRow', () => {
  it('turns the numeric text of the database into map coordinates', () => {
    const house = clubHouseFromRow({ slug: 'g', title: 'G', artist_name: 'Fer', country_code: 'AR', home_lat: '-38.0', home_lng: '-57.6', obras: 3 })
    expect(house).toMatchObject({ slug: 'g', artistName: 'Fer', countryCode: 'AR', obras: 3 })
    expect(house.coordinates[0]).toBeCloseTo(-57.6, 1)
  })
})
