import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { clubGalleryFromRow, type ClubGalleryRow } from './club-galleries'

const row = (overrides: Partial<ClubGalleryRow> = {}): ClubGalleryRow => ({
  id: 'gallery-a',
  user_id: '7D2C0A4E-0000-4000-8000-000000000001',
  slug: 'ana-collage',
  title: 'La galería de Ana',
  statement: 'Una serie de recortes.',
  template_id: 'cabinet',
  theme: 'atelier',
  default_frame_style: 'wood',
  host_avatar_id: 'adult-female-01',
  host_outfit: {},
  music_track: 'default',
  contact_whatsapp: null,
  contact_url: 'https://example.com',
  club_gallery_hangings: [{
    slot: 2,
    frame_style: 'pinned',
    for_sale: false,
    price_label: null,
    artworks: {
      slug: 'obra-uno',
      title: 'Obra uno',
      technique: 'Collage analógico',
      image_url: 'https://images.example/obra.webp',
      profiles: { name: 'Ana', country_code: 'AR' },
    },
  }],
  ...overrides,
})

describe('Club galleries', () => {
  it('maps a hanging to the selected room slot and per-artwork frame', () => {
    const gallery = clubGalleryFromRow(row())
    expect(gallery).toMatchObject({
      slug: 'ana-collage',
      templateId: 'cabinet',
      theme: 'atelier',
      defaultFrameStyle: 'wood',
      artworks: [{ id: 'obra-uno', artist: 'Ana', frameStyle: 'pinned', roomId: 'club-room-01' }],
    })
    expect(gallery?.artworks[0].position).toHaveLength(3)
  })

  it('carries a hash of the member\'s account id, never the id itself', () => {
    const gallery = clubGalleryFromRow(row())
    expect(gallery?.ownerKey).toBe(createHash('sha256').update('7d2c0a4e-0000-4000-8000-000000000001').digest('hex'))
    expect(JSON.stringify(gallery)).not.toMatch(/7d2c0a4e/i)
  })

  it('falls back to the gallery frame and drops incomplete or out-of-capacity hangings', () => {
    const original = row().club_gallery_hangings![0]
    const gallery = clubGalleryFromRow(row({
      club_gallery_hangings: [
        { ...original, slot: 1, frame_style: null },
        { ...original, slot: 9 },
        { ...original, slot: 3, artworks: null },
      ],
    }))
    expect(gallery?.artworks).toHaveLength(1)
    expect(gallery?.artworks[0].frameStyle).toBe('wood')
  })

  it('rejects database values outside the renderer contract', () => {
    expect(clubGalleryFromRow(row({ template_id: 'palace' }))).toBeUndefined()
    expect(clubGalleryFromRow(row({ theme: 'neon' }))).toBeUndefined()
  })

  it('gives every obra the gallery contact: WhatsApp and a web address', () => {
    const gallery = clubGalleryFromRow(row({ contact_whatsapp: ' +54 9 223 555-1234 ', contact_url: 'https://ana.example/obra' }))
    expect(gallery?.artworks[0].contact).toEqual({ whatsapp: '+54 9 223 555-1234', url: 'https://ana.example/obra' })
    expect(gallery).toMatchObject({ contactWhatsapp: '+54 9 223 555-1234', contactUrl: 'https://ana.example/obra' })
  })

  it('leaves out a web address that is not http(s), even if it reached the database', () => {
    const gallery = clubGalleryFromRow(row({ contact_whatsapp: null, contact_url: 'javascript:alert(1)' }))
    expect(gallery?.artworks[0]).not.toHaveProperty('contact')
    expect(gallery?.contactUrl).toBeUndefined()
  })

  it('has no contact on an obra when the member gave none', () => {
    expect(clubGalleryFromRow(row({ contact_whatsapp: null, contact_url: null }))?.artworks[0]).not.toHaveProperty('contact')
  })
})
