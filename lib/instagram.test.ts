import { describe, expect, it } from 'vitest'
import { instagramHandle, instagramUrl } from './instagram'

describe('instagramHandle', () => {
  it('accepts a handle, an @handle or a profile link', () => {
    expect(instagramHandle('lu.gomez')).toBe('lu.gomez')
    expect(instagramHandle(' @hiloypapel_marina ')).toBe('hiloypapel_marina')
    expect(instagramHandle('https://www.instagram.com/ana.collage/?igsh=abc')).toBe('ana.collage')
    expect(instagramHandle(instagramUrl('ana.collage'))).toBe('ana.collage')
  })

  it('rejects placeholders, text and our own account', () => {
    expect(instagramHandle('No informado')).toBeNull()
    expect(instagramHandle('@de')).toBeNull()
    expect(instagramHandle('')).toBeNull()
    expect(instagramHandle(null)).toBeNull()
    expect(instagramHandle('@tehacefaltacollage_')).toBeNull()
  })
})
