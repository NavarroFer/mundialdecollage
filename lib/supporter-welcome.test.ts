import { describe, expect, it } from 'vitest'
import { planSupporterWelcomes, welcomeWindow, type SupporterRow } from './supporter-welcome'

const row = (overrides: Partial<SupporterRow> = {}): SupporterRow => ({
  email: 'tia@example.com',
  contact_id: 'c1',
  supporter_name: null,
  artwork_slug: 'la-ciudad',
  artwork_title: 'La ciudad',
  artist_name: 'Ana Pérez',
  artist_country: 'BR',
  first_at: '2026-10-01T12:00:00Z',
  ...overrides,
})

describe('planSupporterWelcomes', () => {
  it('sends in the language of the artist they backed', () => {
    const { send, skip } = planSupporterWelcomes([row()], [])
    expect(skip).toEqual([])
    expect(send[0]).toMatchObject({ email: 'tia@example.com', locale: 'pt' })
  })

  it('skips admins, invalid addresses and obras without an artist name', () => {
    const { send, skip } = planSupporterWelcomes(
      [row({ email: 'admin@example.com' }), row({ email: 'not-an-email' }), row({ email: 'b@example.com', artist_name: ' ' })],
      ['admin@example.com'],
    )
    expect(send).toEqual([])
    expect(skip.map((s) => s.reason)).toEqual(['admin', 'email inválido', 'obra sin artista'])
  })
})

describe('welcomeWindow', () => {
  it('greets first interactions between 7 days and 12 hours ago', () => {
    const now = new Date('2026-10-10T12:00:00Z')
    const { since, until } = welcomeWindow(now)
    expect(since.toISOString()).toBe('2026-10-03T12:00:00.000Z')
    expect(until.toISOString()).toBe('2026-10-10T00:00:00.000Z')
  })
})
