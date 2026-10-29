import { describe, expect, it } from 'vitest'
import { fitsRoom, optionState, parseGallerySettings, parseHangings, roomCapacity, shopItems, statsSince, statsTotals, type StatsRow } from './club-editor'

const form = (fields: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}
const base = { title: ' Mi muestra ', statement: '', template_id: 'cabinet', theme: 'collage', default_frame_style: 'standard', contact_whatsapp: '', contact_url: '' }
const none = new Set<string>()

describe('roomCapacity', () => {
  it('matches the capacities the database enforces (8, 14 and 22)', () => {
    expect([roomCapacity('cabinet'), roomCapacity('classic'), roomCapacity('double')]).toEqual([8, 14, 22])
  })
})

describe('optionState', () => {
  it('includes the base options and locks the rest until they are bought', () => {
    expect(optionState('room', 'cabinet', none)).toBe('available')
    expect(optionState('theme', 'windows98', none)).toBe('available')
    expect(optionState('frame', 'standard', none)).toBe('available')
    expect(optionState('theme', 'museum', none)).toBe('locked')
    expect(optionState('theme', 'museum', new Set(['theme:museum']))).toBe('available')
    expect(optionState('room', 'double', none)).toBe('locked')
  })
  it('treats an option the catalogue does not know as locked', () => {
    expect(optionState('theme', 'nope', new Set(['theme:nope']))).toBe('locked')
  })
})

describe('shopItems', () => {
  it('lists what can be bought and drops what the artist owns', () => {
    const all = shopItems(none).map((item) => item.id)
    expect(all).toContain('theme:museum')
    expect(all).toContain('room:classic')
    expect(all).not.toContain('theme:collage')
    expect(all).not.toContain('avatar-accessory:beret')
    expect(shopItems(new Set(['theme:museum'])).map((item) => item.id)).not.toContain('theme:museum')
  })
})

describe('parseGallerySettings', () => {
  it('trims the text and turns empty optional fields into null', () => {
    expect(parseGallerySettings(form(base), none)).toEqual({
      ok: true,
      settings: { title: 'Mi muestra', statement: null, template_id: 'cabinet', theme: 'collage', default_frame_style: 'standard', contact_whatsapp: null, contact_url: null },
    })
  })
  it('accepts a contact number and a web address', () => {
    const result = parseGallerySettings(form({ ...base, contact_whatsapp: '+54 9 223 555-1234', contact_url: 'https://ana.example/obra' }), none)
    expect(result).toMatchObject({ ok: true, settings: { contact_whatsapp: '+54 9 223 555-1234', contact_url: 'https://ana.example/obra' } })
  })
  it.each([
    ['an empty title', { title: '  ' }],
    ['a title over 120 characters', { title: 'x'.repeat(121) }],
    ['a statement over 5000 characters', { statement: 'x'.repeat(5001) }],
    ['an unknown room', { template_id: 'palace' }],
    ['an unknown theme', { theme: 'neon' }],
    ['an unknown frame', { default_frame_style: 'chrome' }],
    ['letters in the phone', { contact_whatsapp: 'llamame' }],
    ['a javascript: address', { contact_url: 'javascript:alert(1)' }],
    ['an address that is not one', { contact_url: 'mi sitio' }],
  ])('rejects %s', (_label, change) => {
    expect(parseGallerySettings(form({ ...base, ...change }), none)).toEqual({ ok: false, error: 'invalid' })
  })
  it('refuses a theme, room or frame that is not unlocked, and accepts it once it is', () => {
    expect(parseGallerySettings(form({ ...base, theme: 'museum' }), none)).toEqual({ ok: false, error: 'locked' })
    expect(parseGallerySettings(form({ ...base, template_id: 'double' }), none)).toEqual({ ok: false, error: 'locked' })
    expect(parseGallerySettings(form({ ...base, default_frame_style: 'gold' }), none)).toEqual({ ok: false, error: 'locked' })
    expect(parseGallerySettings(form({ ...base, theme: 'museum' }), new Set(['theme:museum']))).toMatchObject({ ok: true })
  })
})

describe('parseHangings', () => {
  const mine = new Set(['a', 'b', 'c'])
  it('returns the hung obras in order of position and skips the empty ones', () => {
    expect(parseHangings(form({ 'slot:a': '3', 'slot:b': '', 'slot:c': '1' }), 8, mine)).toEqual({
      ok: true,
      rows: [{ slot: 1, artwork_id: 'c', frame_style: '' }, { slot: 3, artwork_id: 'a', frame_style: '' }],
    })
  })
  it('accepts an empty room', () => {
    expect(parseHangings(form({ 'slot:a': '' }), 8, mine)).toEqual({ ok: true, rows: [] })
  })
  it.each([
    ['two obras in one position', { 'slot:a': '2', 'slot:b': '2' }],
    ['a position past the room', { 'slot:a': '9' }],
    ['position zero', { 'slot:a': '0' }],
    ['a decimal position', { 'slot:a': '1.5' }],
    ['text instead of a position', { 'slot:a': 'uno' }],
    ["someone else's obra", { 'slot:zzz': '1' }],
  ])('rejects %s', (_label, fields) => {
    expect(parseHangings(form(fields), 8, mine)).toEqual({ ok: false, error: 'invalid' })
  })
})

describe('fitsRoom', () => {
  it('only lets a smaller room in when nothing hangs past its last position', () => {
    expect(fitsRoom([1, 5, 8], 8)).toBe(true)
    expect(fitsRoom([1, 9], 8)).toBe(false)
    expect(fitsRoom([], 8)).toBe(true)
  })
})

describe('statsTotals', () => {
  const row = (over: Partial<StatsRow>): StatsRow => ({ artwork_id: 'a', slug: 'a', title: 'A', slot: 1, viewers: 0, view_seconds: 0, details_seconds: 0, stamps: 0, likes: 0, ...over })

  it('adds seconds, stamps and likes, reading the numeric text the database sends', () => {
    expect(statsTotals([
      row({ view_seconds: '8.0', details_seconds: '4.0', stamps: 2, likes: '2' }),
      row({ slot: 2, view_seconds: '3.3', details_seconds: '0.0', stamps: 1, likes: 0 }),
    ])).toEqual({ viewSeconds: 11.3, detailsSeconds: 4, stamps: 3, likes: 2 })
  })

  it('does not add people up, since one person can look at several obras', () => {
    expect(statsTotals([row({ viewers: 5 }), row({ viewers: 5 })])).not.toHaveProperty('viewers')
  })

  it('is all zeros for a gallery with nothing hung', () => {
    expect(statsTotals([])).toEqual({ viewSeconds: 0, detailsSeconds: 0, stamps: 0, likes: 0 })
  })
})

describe('statsSince', () => {
  it('goes back the given number of days from now', () => {
    expect(statsSince(30, new Date('2026-11-30T12:00:00.000Z'))).toBe('2026-10-31T12:00:00.000Z')
    expect(statsSince(0, new Date('2026-11-30T12:00:00.000Z'))).toBe('2026-11-30T12:00:00.000Z')
  })
})
