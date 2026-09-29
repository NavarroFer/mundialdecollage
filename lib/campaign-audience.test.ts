import { describe, expect, it } from 'vitest'
import { audienceLabel, contactsWithoutArtwork, parseAudience } from './campaign-audience'

describe('parseAudience', () => {
  it('defaults to every subscriber for anything unknown', () => {
    expect(parseAudience('no_artwork')).toBe('no_artwork')
    expect(parseAudience('subscribed')).toBe('subscribed')
    expect(parseAudience('everyone')).toBe('subscribed')
    expect(parseAudience(undefined)).toBe('subscribed')
  })

  it('labels campaigns saved before audiences existed as every subscriber', () => {
    expect(audienceLabel(null)).toBe('Todos los suscriptos')
    expect(audienceLabel('no_artwork')).toBe('Cuentas sin obra')
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
