import { describe, expect, it, vi } from 'vitest'
import { certificateLinks, certificateOverview, certificateUnreachableReason, type CertificateRecipientRow } from './certificate-mail'
import { certificateToken } from './certificate-token'

vi.mock('@/lib/site', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/site')>()),
  getSiteUrl: () => 'https://example.org',
}))

const row = (over: Partial<CertificateRecipientRow> = {}): CertificateRecipientRow => ({
  profile_id: 'p1',
  artist_name: 'Camila',
  country_code: 'BR',
  email: 'camila@example.com',
  contact_id: 'c1',
  subscribed: true,
  artwork_slug: 'la-ciudad',
  artwork_title: 'La ciudad',
  ...over,
})

describe('certificateUnreachableReason', () => {
  it('lets a complete artist through, subscribed or not', () => {
    expect(certificateUnreachableReason(row())).toBeNull()
    expect(certificateUnreachableReason(row({ subscribed: false, contact_id: null }))).toBeNull()
  })

  it('skips missing or bad addresses, admins and incomplete profiles', () => {
    expect(certificateUnreachableReason(row({ email: null }))).toBe('No tiene email')
    expect(certificateUnreachableReason(row({ email: 'nope' }))).toBe('Formato de email inválido')
    expect(certificateUnreachableReason(row({ email: 'mundialdecollage@gmail.com' }))).toBe('Es admin')
    expect(certificateUnreachableReason(row({ artist_name: ' ' }))).toBe('Le falta el nombre o el país')
    expect(certificateUnreachableReason(row({ country_code: null }))).toBe('Le falta el nombre o el país')
  })
})

describe('certificateOverview', () => {
  it('counts sent, failed, sending and pending, and sends pending plus failed', () => {
    const rows = [
      row({ profile_id: 'sent' }),
      row({ profile_id: 'failed', country_code: 'IT' }),
      row({ profile_id: 'sending' }),
      row({ profile_id: 'new', country_code: 'AR' }),
      row({ profile_id: 'nomail', email: null }),
    ]
    const sends = new Map([['sent', 'sent'], ['failed', 'failed'], ['sending', 'sending']] as const)
    const o = certificateOverview(rows, new Map(sends))
    expect(o).toMatchObject({ total: 5, sent: 1, failed: 1, sending: 1, pending: 1, sampleSlug: 'la-ciudad' })
    expect(o.unreachable.map((u) => u.row.profile_id)).toEqual(['nomail'])
    expect(o.toSend.map((r) => [r.profile_id, r.locale, r.retry])).toEqual([['failed', 'it', true], ['new', 'es', false]])
  })

  it("doesn't count an already sent artist as unreachable later on", () => {
    const o = certificateOverview([row({ profile_id: 'x', country_code: null })], new Map([['x', 'sent' as const]]))
    expect(o).toMatchObject({ sent: 1, unreachable: [] })
  })
})

describe('certificateLinks', () => {
  it('signs both formats with the slug token', () => {
    const t = certificateToken('la-ciudad', 'k')
    expect(certificateLinks('la-ciudad', 'k')).toEqual({
      pdf: `https://example.org/obras/la-ciudad/certificado?formato=pdf&t=${t}`,
      image: `https://example.org/obras/la-ciudad/certificado?formato=imagen&t=${t}`,
    })
  })
})
