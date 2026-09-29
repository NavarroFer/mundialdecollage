import { describe, expect, it } from 'vitest'
import { parseReferral, readReferralCookie, readReferralParam, withReferral } from './referral'
import { galleryArtworkPath, readSharedArtwork } from './gallery-return'

describe('referral links', () => {
  it('accepts slug-shaped refs only', () => {
    expect(parseReferral('sofia-ramirez-luz-y-sombra')).toBe('sofia-ramirez-luz-y-sombra')
    expect(parseReferral('ana-2')).toBe('ana-2')
    expect(parseReferral('Ana')).toBeNull()
    expect(parseReferral('ana--b')).toBeNull()
    expect(parseReferral('-ana')).toBeNull()
    expect(parseReferral('ana b')).toBeNull()
    expect(parseReferral('<script>')).toBeNull()
    expect(parseReferral('')).toBeNull()
    expect(parseReferral(undefined)).toBeNull()
    expect(parseReferral(['ana'])).toBeNull()
    expect(parseReferral('a'.repeat(201))).toBeNull()
  })

  it('tags a path, keeping what it already had', () => {
    expect(withReferral('/obras/ana-luz', 'ana-luz')).toBe('/obras/ana-luz?ref=ana-luz')
    expect(withReferral('/', 'ana-luz')).toBe('/?ref=ana-luz')
    const gallery = withReferral(galleryArtworkPath('ana-luz'), 'ana-luz')
    expect(gallery).toBe('/galeria-3d?obra=ana-luz&ref=ana-luz')
    expect(readReferralParam(gallery.split('?')[1])).toBe('ana-luz')
  })

  it('still opens the shared obra in the gallery with a ref attached', () => {
    const gallery = withReferral(galleryArtworkPath('ana-luz'), 'ana-luz')
    expect(readSharedArtwork(gallery.slice(gallery.indexOf('?')))).toBe('ana-luz')
  })

  it('reads the cookie among others', () => {
    expect(readReferralCookie('mdc-vid=abc12345; mdc-ref=ana-luz; NEXT_LOCALE=es')).toBe('ana-luz')
    expect(readReferralCookie('mdc-ref=ana-luz')).toBe('ana-luz')
    expect(readReferralCookie('xmdc-ref=ana-luz')).toBeNull()
    expect(readReferralCookie('mdc-ref=%3Cx%3E')).toBeNull()
    expect(readReferralCookie('')).toBeNull()
  })
})
