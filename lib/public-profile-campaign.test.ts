import { describe, expect, it } from 'vitest'
import { campaignRecipientValues } from '@/lib/campaign-delivery'
import { personalizeHtmlWithValues, renderEmailDocumentToHtml } from '@/lib/email-blocks'
import { SYSTEM_TEMPLATES } from '@/lib/system-templates'
import { getSiteUrl } from '@/lib/site'
import { leadArtwork, mailImageUrl } from '@/lib/artist-profile-mail'
import { campaignBlockedByTags } from '@/lib/campaign-audience'

describe('artist profile campaign', () => {
  const slug = 'ana-perez-11111111-1111-1111-1111-111111111111'
  const values = campaignRecipientValues({ id: 'c', email: 'ana@x.invalid', name: 'Ana', locale: 'es', profileSlug: slug })

  it('links each artist to their own profile', () => {
    expect(values.perfil_url).toBe(`${getSiteUrl()}/artistas/${slug}`)
  })

  it('fills the template with that link and leaves no tag behind', () => {
    const html = personalizeHtmlWithValues(renderEmailDocumentToHtml(SYSTEM_TEMPLATES.perfil_artista.createDocument('https://example.com')), values)
    expect(html).toContain(`href="${getSiteUrl()}/artistas/${slug}"`)
    expect(html).toContain('Ana, tu perfil ya está online')
    expect(html).not.toMatch(/\{\{/)
  })

  it('leads with the title, then the artist\'s own obra, then a single main button', () => {
    const blocks = SYSTEM_TEMPLATES.perfil_artista.createDocument('https://example.com').blocks
    const obra = blocks.findIndex((block) => block.type === 'image' && block.url === '{{obra_imagen}}')
    const mainButton = blocks.findIndex((block) => block.type === 'button')
    expect(blocks.find((block) => block.type === 'heading')).toMatchObject({ size: 'lg' })
    expect(obra).toBeGreaterThan(blocks.findIndex((block) => block.type === 'heading'))
    expect(mainButton).toBeGreaterThan(obra)
    expect(blocks[mainButton]).toMatchObject({ text: 'Ver mi perfil', url: '{{perfil_url}}', color: 'red' })
    expect(blocks.filter((block) => block.type === 'button' && block.color === 'red')).toHaveLength(1)
  })

  it('shows each artist their own obra and numbers', () => {
    const own = campaignRecipientValues({
      id: 'c', email: 'ana@x.invalid', name: 'Ana', locale: 'es', profileSlug: slug,
      profileMail: { imageUrl: 'https://example.com/api/img?url=x&w=1080', title: 'Mar de papel', slug: 'mar-de-papel', obras: 2, likes: 41, comments: 5 },
    })
    expect(own).toMatchObject({ obra_titulo: 'Mar de papel', perfil_obras: '2', perfil_likes: '41', perfil_comentarios: '5' })
    expect(own.publicar_url).toBe(`${getSiteUrl()}/obras/mar-de-papel#publicar`)
    const html = personalizeHtmlWithValues(renderEmailDocumentToHtml(SYSTEM_TEMPLATES.perfil_artista.createDocument('https://example.com')), own)
    expect(html).toContain('src="https://example.com/api/img?url=x&amp;w=1080"')
    expect(html).toContain('Me gusta: 41')
    expect(html).not.toMatch(/\{\{/)
  })

  it('shows zeros, not a blank, for an obra nobody has reacted to yet', () => {
    const values = campaignRecipientValues({
      id: 'c', email: 'ana@x.invalid', name: 'Ana', locale: 'es', profileSlug: slug,
      profileMail: { imageUrl: 'https://example.com/a.jpg', title: null, slug: 'sin-titulo', obras: 1, likes: 0, comments: 0 },
    })
    expect(values).toMatchObject({ obra_titulo: 'Sin título', perfil_likes: '0', perfil_comentarios: '0' })
  })

  it('has no profile link for a contact outside that audience', () => {
    expect(campaignRecipientValues({ id: 'c', email: 'x@x.invalid', name: 'X', locale: 'es' }).perfil_url).toBeUndefined()
  })
})

describe('the obra a profile mail leads with', () => {
  const row = (id: string, over: Partial<Parameters<typeof leadArtwork>[0][number]>) => ({ id, profile_id: 'p', slug: id, title: id, image_url: `https://s.invalid/${id}.jpg`, is_selected: false, created_at: '2026-10-01T00:00:00Z', ...over })

  it('prefers the one chosen to take part, then the newest', () => {
    expect(leadArtwork([row('old', {}), row('chosen', { is_selected: true, created_at: '2026-09-01T00:00:00Z' }), row('new', { created_at: '2026-11-01T00:00:00Z' })])?.id).toBe('chosen')
    expect(leadArtwork([row('old', {}), row('new', { created_at: '2026-11-01T00:00:00Z' })])?.id).toBe('new')
  })

  it('skips an obra without an image', () => {
    expect(leadArtwork([row('blank', { image_url: ' ', is_selected: true }), row('ok', {})])?.id).toBe('ok')
    expect(leadArtwork([row('blank', { image_url: null })])).toBeUndefined()
  })

  it('serves a stored photo through the cached, resized endpoint on the site\'s own domain', () => {
    const previous = process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co'
    try {
      const url = mailImageUrl('https://abc.supabase.co/storage/v1/object/public/artworks/a.jpg')
      expect(url.startsWith(`${getSiteUrl()}/api/img?url=`)).toBe(true)
      expect(url).toContain('&w=1080')
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
      else process.env.NEXT_PUBLIC_SUPABASE_URL = previous
    }
  })
})

describe('sending the profile mail to the wrong audience', () => {
  const html = renderEmailDocumentToHtml(SYSTEM_TEMPLATES.perfil_artista.createDocument('https://example.com'))

  it('is refused for everyone but the artists with a public profile', () => {
    expect(campaignBlockedByTags('subscribed', html)).toMatch(/Artistas con perfil público/)
    expect(campaignBlockedByTags('no_artwork', html)).not.toBeNull()
    expect(campaignBlockedByTags('public_profiles', html)).toBeNull()
  })

  it('leaves any other mail alone', () => {
    expect(campaignBlockedByTags('subscribed', '<p>Hola {{nombre}}</p>')).toBeNull()
  })
})

