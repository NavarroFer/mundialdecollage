import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CertificateInput } from '@/lib/certificate'
import { MESSAGES } from '@/lib/i18n/messages'
import { certificateFile } from '@/lib/certificate-cache'

const draws = vi.hoisted(() => ({ diploma: 0, post: 0, complete: true }))
const bucket = vi.hoisted(() => new Map<string, Buffer>())

vi.mock('@/lib/r2', () => ({
  imageStore: () => ({
    get: async (key: string) => bucket.get(key) ?? null,
    put: async (key: string, body: Buffer) => void bucket.set(key, body),
  }),
}))
vi.mock('@/lib/share-image-cache', () => ({ photoVersion: async () => 'versioned' }))
vi.mock('@/lib/certificate', async (original) => ({
  ...(await original<typeof import('@/lib/certificate')>()),
  diplomaJpeg: async () => {
    draws.diploma++
    return { jpeg: Buffer.from('diploma'), complete: draws.complete }
  },
  diplomaPreview: async (jpeg: Buffer) => Buffer.concat([jpeg, Buffer.from('-small')]),
  diplomaPdf: async (jpeg: Buffer) => new Uint8Array(Buffer.concat([jpeg, Buffer.from('-pdf')])),
  certificatePostImage: async () => {
    draws.post++
    return { png: Buffer.from('post'), complete: draws.complete }
  },
}))

const input = (name = 'Ana Pérez'): CertificateInput => ({
  finalist: { profileId: 'p', slug: 'obra', name, countryCode: 'AR', artworkTitle: 'Mar', imageUrl: 'https://x.invalid/user/1760000000000-0.jpg' },
  locale: 'es',
  m: MESSAGES.es,
  verifyUrl: 'https://mundialdecollage.com.ar/obras/obra',
  issuedISO: '2026-11-21T12:00:00-03:00',
})

describe('certificateFile', () => {
  beforeEach(() => {
    bucket.clear()
    draws.diploma = 0
    draws.post = 0
    draws.complete = true
  })

  it('draws the diploma once for the PDF and the preview, then reads them back', async () => {
    expect((await certificateFile('pdf', input())).body.toString()).toBe('diploma-pdf')
    expect((await certificateFile('preview', input())).body.toString()).toBe('diploma-small')
    await certificateFile('pdf', input())
    await certificateFile('preview', input())
    expect(draws.diploma).toBe(1)
  })

  it('keeps the Instagram image too', async () => {
    await certificateFile('post', input())
    const again = await certificateFile('post', input())
    expect(again).toEqual({ body: Buffer.from('post'), contentType: 'image/png' })
    expect(draws.post).toBe(1)
  })

  it('draws anew when what it prints changes', async () => {
    await certificateFile('pdf', input('Ana Pérez'))
    await certificateFile('pdf', input('Ana María Pérez'))
    expect(draws.diploma).toBe(2)
  })

  it("doesn't keep one drawn without the obra's photo", async () => {
    draws.complete = false
    await certificateFile('post', input())
    await certificateFile('post', input())
    expect(draws.post).toBe(2)
    expect(bucket.size).toBe(0)
  })
})
