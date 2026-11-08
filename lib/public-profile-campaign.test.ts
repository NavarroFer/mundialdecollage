import { describe, expect, it } from 'vitest'
import { campaignRecipientValues } from '@/lib/campaign-delivery'
import { personalizeHtmlWithValues, renderEmailDocumentToHtml } from '@/lib/email-blocks'
import { SYSTEM_TEMPLATES } from '@/lib/system-templates'
import { getSiteUrl } from '@/lib/site'

describe('artist profile campaign', () => {
  const slug = 'ana-perez-11111111-1111-1111-1111-111111111111'
  const values = campaignRecipientValues({ id: 'c', email: 'ana@x.invalid', name: 'Ana', locale: 'es', profileSlug: slug })

  it('links each artist to their own profile', () => {
    expect(values.perfil_url).toBe(`${getSiteUrl()}/artistas/${slug}`)
  })

  it('fills the template with that link and leaves no tag behind', () => {
    const html = personalizeHtmlWithValues(renderEmailDocumentToHtml(SYSTEM_TEMPLATES.perfil_artista.createDocument('https://example.com')), values)
    expect(html).toContain(`href="${getSiteUrl()}/artistas/${slug}"`)
    expect(html).toContain('Hola Ana')
    expect(html).not.toMatch(/\{\{/)
  })

  it('has no profile link for a contact outside that audience', () => {
    expect(campaignRecipientValues({ id: 'c', email: 'x@x.invalid', name: 'X', locale: 'es' }).perfil_url).toBeUndefined()
  })
})
