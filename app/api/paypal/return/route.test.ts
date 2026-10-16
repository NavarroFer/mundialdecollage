import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ capture: vi.fn() }))
vi.mock('@/lib/payments/providers/paypal', () => ({ capturePayPalOrder: mocks.capture }))
vi.mock('@/lib/site', () => ({ getSiteUrl: () => 'https://mundial.test' }))

import { GET } from './route'

function back(params: Record<string, string>) {
  const url = new URL('https://mundial.test/api/paypal/return')
  const ways = { success: 'https://mundial.test/donar/gracias', pending: 'https://mundial.test/donar/pendiente', failure: 'https://mundial.test/#donar' }
  for (const [name, value] of Object.entries({ ...ways, ...params })) url.searchParams.set(name, value)
  return GET(new Request(url))
}

beforeEach(() => mocks.capture.mockReset())

describe('PayPal way back', () => {
  it('captures an approved order and goes on by how it went', async () => {
    mocks.capture.mockResolvedValueOnce('approved')
    expect((await back({ token: 'ORDER123' })).headers.get('location')).toBe('https://mundial.test/donar/gracias')
    mocks.capture.mockResolvedValueOnce('pending')
    expect((await back({ token: 'ORDER123' })).headers.get('location')).toBe('https://mundial.test/donar/pendiente')
    mocks.capture.mockResolvedValueOnce('rejected')
    expect((await back({ token: 'ORDER123' })).headers.get('location')).toBe('https://mundial.test/#donar')
    expect(mocks.capture).toHaveBeenCalledWith('ORDER123')
  })

  it('goes back without capturing when the buyer cancelled', async () => {
    expect((await back({ token: 'ORDER123', cancel: '1' })).headers.get('location')).toBe('https://mundial.test/#donar')
    expect(mocks.capture).not.toHaveBeenCalled()
  })

  it('only ever sends the buyer to this site', async () => {
    mocks.capture.mockResolvedValue('approved')
    expect((await back({ token: 'ORDER123', success: 'https://evil.test/phish' })).headers.get('location')).toBe('https://mundial.test/')
    expect((await back({ token: 'ORDER123', success: '//evil.test' })).headers.get('location')).toBe('https://mundial.test/')
  })
})
