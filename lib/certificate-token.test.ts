import { afterEach, describe, expect, it, vi } from 'vitest'
import { certificateSecret, certificateToken, isValidCertificateToken } from './certificate-token'

describe('certificateToken', () => {
  it('is 32 hex chars, stable per slug and secret', () => {
    const token = certificateToken('la-ciudad', 's3cret')
    expect(token).toMatch(/^[0-9a-f]{32}$/)
    expect(certificateToken('la-ciudad', 's3cret')).toBe(token)
  })

  it('changes with the slug and with the secret', () => {
    const token = certificateToken('la-ciudad', 's3cret')
    expect(certificateToken('otra-obra', 's3cret')).not.toBe(token)
    expect(certificateToken('la-ciudad', 'other')).not.toBe(token)
  })
})

describe('isValidCertificateToken', () => {
  const secret = 's3cret'
  const token = certificateToken('la-ciudad', secret)

  it('accepts the token of that slug', () => {
    expect(isValidCertificateToken('la-ciudad', token, secret)).toBe(true)
  })

  it("rejects another slug's token, a tampered one, or a wrong length", () => {
    expect(isValidCertificateToken('otra-obra', token, secret)).toBe(false)
    expect(isValidCertificateToken('la-ciudad', `${token.slice(0, -1)}${token.endsWith('0') ? '1' : '0'}`, secret)).toBe(false)
    expect(isValidCertificateToken('la-ciudad', token.slice(0, 16), secret)).toBe(false)
    expect(isValidCertificateToken('la-ciudad', `${token}00`, secret)).toBe(false)
  })

  it('rejects everything without a token or a secret', () => {
    expect(isValidCertificateToken('la-ciudad', null, secret)).toBe(false)
    expect(isValidCertificateToken('la-ciudad', '', secret)).toBe(false)
    expect(isValidCertificateToken('la-ciudad', token, null)).toBe(false)
  })
})

describe('certificateSecret', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('prefers CERTIFICATE_SECRET, falls back to CRON_SECRET', () => {
    vi.stubEnv('CERTIFICATE_SECRET', 'cert')
    vi.stubEnv('CRON_SECRET', 'cron')
    expect(certificateSecret()).toBe('cert')
    vi.stubEnv('CERTIFICATE_SECRET', '')
    expect(certificateSecret()).toBe('cron')
    vi.stubEnv('CRON_SECRET', '')
    expect(certificateSecret()).toBeNull()
  })
})
