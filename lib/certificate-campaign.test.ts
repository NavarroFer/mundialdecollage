import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { campaignRecipientValues } from '@/lib/campaign-delivery'
import { campaignBlockedByTags } from '@/lib/campaign-audience'
import { isValidCertificateToken } from '@/lib/certificate-token'
import { personalizeHtmlWithValues, renderEmailDocumentToHtml } from '@/lib/email-blocks'
import { getSiteUrl } from '@/lib/site'
import { SYSTEM_TEMPLATES } from '@/lib/system-templates'

// «Artistas con certificado»: the reminder campaign that sends each artist to
// their own certificate.
describe('certificate reminder campaign', () => {
  beforeEach(() => vi.stubEnv('CERTIFICATE_SECRET', 'test-secret'))
  afterEach(() => vi.unstubAllEnvs())

  const recipient = { id: 'c', email: 'ana@x.invalid', name: 'Ana Pérez', locale: 'es' as const, certificate: { slug: 'mar-de-papel', title: 'Mar de papel' } }

  it('links each artist to their own certificate, signed so it opens without signing in', () => {
    const url = new URL(campaignRecipientValues(recipient).certificado_url!)
    expect(url.origin + url.pathname).toBe(`${getSiteUrl()}/mi-certificado`)
    expect(url.searchParams.get('obra')).toBe('mar-de-papel')
    expect(isValidCertificateToken('mar-de-papel', url.searchParams.get('t'), 'test-secret')).toBe(true)
  })

  it('names the obra, and has no link for anyone outside the audience', () => {
    expect(campaignRecipientValues(recipient).obra_titulo).toBe('Mar de papel')
    expect(campaignRecipientValues({ ...recipient, certificate: { slug: 's', title: null } }).obra_titulo).toBe('Sin título')
    expect(campaignRecipientValues({ id: 'x', email: 'x@x.invalid', name: 'X', locale: 'es' }).certificado_url).toBeUndefined()
  })

  it('fills the template and leaves no tag behind', () => {
    const doc = SYSTEM_TEMPLATES.recordatorio_certificado.createDocument('https://example.com')
    const html = personalizeHtmlWithValues(renderEmailDocumentToHtml(doc), campaignRecipientValues(recipient))
    expect(html).toContain('Ana Pérez, tu certificado te está esperando')
    expect(html).toContain('«Mar de papel»')
    expect(html).toContain(`href="${getSiteUrl()}/mi-certificado?obra=mar-de-papel&amp;t=`)
    expect(html).not.toMatch(/\{\{/)
  })

  it('refuses {{certificado_url}} for any other audience', () => {
    const html = '<a href="{{certificado_url}}">Ver</a>'
    expect(campaignBlockedByTags('subscribed', html)).toMatch(/Artistas con certificado/)
    expect(campaignBlockedByTags('public_profiles', html)).not.toBeNull()
    expect(campaignBlockedByTags('certificates', html)).toBeNull()
  })
})
