import { describe, expect, it } from 'vitest'
import { audienceContacts, audienceLabel, contactsClubProspects, contactsNotParticipating, contactsWithoutArtwork, parseAudience } from './campaign-audience'
import type { SupabaseClient } from '@supabase/supabase-js'

describe('parseAudience', () => {
  it('defaults to every subscriber for anything unknown', () => {
    expect(parseAudience('no_artwork')).toBe('no_artwork')
    expect(parseAudience('subscribed')).toBe('subscribed')
    expect(parseAudience('profile_review')).toBe('profile_review')
    expect(parseAudience('everyone')).toBe('subscribed')
    expect(parseAudience(undefined)).toBe('subscribed')
  })

  it('labels campaigns saved before audiences existed as every subscriber', () => {
    expect(audienceLabel(null)).toBe('Todos los suscriptos')
    expect(audienceLabel('no_artwork')).toBe('Cuentas sin obra')
    expect(audienceLabel('profile_review')).toBe('Datos por confirmar')
  })
})

describe('contactsWithoutArtwork', () => {
  const subscribed = [
    { id: '1', email: 'ana@example.com' },
    { id: '2', email: 'Beto@Example.com ' },
    { id: '3', email: 'caro@example.com' },
    { id: '4', email: 'admin@example.com' },
  ]

  it('keeps only subscribers whose login has no obra, whatever the casing', () => {
    const accounts = ['ANA@example.com', ' beto@example.com', 'nobody-subscribed@example.com']
    expect(contactsWithoutArtwork(subscribed, accounts, []).map((contact) => contact.id)).toEqual(['1', '2'])
  })

  it('never includes an admin', () => {
    const accounts = ['ana@example.com', 'admin@example.com']
    expect(contactsWithoutArtwork(subscribed, accounts, ['Admin@example.com']).map((contact) => contact.id)).toEqual(['1'])
  })

  it('is empty when every account already sent an obra', () => {
    expect(contactsWithoutArtwork(subscribed, [], [])).toEqual([])
  })
})

describe('contactsNotParticipating', () => {
  it('leaves out participants (any casing) and admins', () => {
    const subscribed = [
      { id: '1', email: 'fan@example.com' },
      { id: '2', email: 'Artist@Example.com' },
      { id: '3', email: 'admin@example.com' },
    ]
    expect(contactsNotParticipating(subscribed, [' artist@example.com '], ['admin@example.com']).map((c) => c.id)).toEqual(['1'])
  })
})

describe('club_prospects', () => {
  const subscribed = [
    { id: '1', email: 'ana@example.com' },
    { id: '2', email: 'Beto@Example.com ' },
    { id: '3', email: 'caro@example.com' },
    { id: '4', email: 'admin@example.com' },
    { id: '5', email: 'dana@example.com' },
  ]

  it('is a campaign audience and is parsed as itself', () => {
    expect(parseAudience('club_prospects')).toBe('club_prospects')
    expect(audienceLabel('club_prospects')).toBe('Artistas sin galería del Club')
  })

  it('keeps who took part and has no Club gallery, whatever the casing, and never an admin', () => {
    const participants = ['ANA@example.com', ' beto@example.com', 'caro@example.com', 'admin@example.com', 'ghost@example.com']
    const members = ['caro@EXAMPLE.com']
    expect(contactsClubProspects(subscribed, participants, members, ['admin@example.com']).map((contact) => contact.id)).toEqual(['1', '2'])
  })

  it('leaves out a subscriber who never took part', () => {
    expect(contactsClubProspects(subscribed, ['ana@example.com'], [], []).map((contact) => contact.id)).toEqual(['1'])
  })

  function fakeClient(rpc: Record<string, { data: unknown; error: { message: string } | null }>) {
    return {
      from: () => ({ select: () => ({ eq: async () => ({ data: subscribed, error: null }) }) }),
      rpc: async (name: string) => rpc[name],
    } as unknown as SupabaseClient
  }

  it('reads both lists from the database', async () => {
    const supabase = fakeClient({
      participant_emails: { data: [{ email: 'ana@example.com' }, { email: 'caro@example.com' }, { email: null }], error: null },
      club_member_emails: { data: [{ email: 'caro@example.com' }], error: null },
    })
    const { contacts, error } = await audienceContacts(supabase, 'club_prospects')
    expect(error).toBeNull()
    expect(contacts.map((contact) => contact.id)).toEqual(['1'])
  })

  it('never falls back to everyone when a list cannot be read', async () => {
    const ok = { data: [], error: null }
    const failing = { data: null, error: { message: 'boom' } }
    for (const rpc of [{ participant_emails: failing, club_member_emails: ok }, { participant_emails: ok, club_member_emails: failing }]) {
      expect(await audienceContacts(fakeClient(rpc), 'club_prospects')).toEqual({ contacts: [], error: 'boom' })
    }
  })
})
