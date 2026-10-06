import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getFinalists: vi.fn(), randomInt: vi.fn() }))
vi.mock('@/lib/finalists', () => ({ getFinalists: mocks.getFinalists }))
vi.mock('node:crypto', () => ({ randomInt: mocks.randomInt }))
import { GET } from './route'

beforeEach(() => {
  mocks.getFinalists.mockResolvedValue([{ slug: 'primera' }, { slug: 'segunda' }])
  mocks.randomInt.mockReturnValue(0)
})

describe('surprise artwork', () => {
  it('chooses from the public listing and does not cache the random redirect', async () => {
    mocks.randomInt.mockReturnValue(1)
    const response = await GET(new Request('https://example.com/api/artworks/surprise'))
    expect(mocks.randomInt).toHaveBeenCalledWith(2)
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://example.com/obras/segunda')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
  })

  it('never selects the artwork the visitor is already viewing', async () => {
    const response = await GET(new Request('https://example.com/api/artworks/surprise?exclude=primera'))
    expect(mocks.randomInt).toHaveBeenCalledWith(1)
    expect(response.headers.get('location')).toBe('https://example.com/obras/segunda')
  })

  it('falls back to discovery when no other works are available', async () => {
    mocks.getFinalists.mockResolvedValue([{ slug: 'primera' }])
    const response = await GET(new Request('https://example.com/api/artworks/surprise?exclude=primera'))
    expect(response.headers.get('location')).toBe('https://example.com/#participantes')
  })

  it('handles an empty public listing', async () => {
    mocks.getFinalists.mockResolvedValue([])
    const response = await GET(new Request('https://example.com/api/artworks/surprise'))
    expect(response.headers.get('location')).toBe('https://example.com/#participantes')
  })

  it('cannot use the excluded slug to redirect to an external site', async () => {
    const response = await GET(new Request('https://example.com/api/artworks/surprise?exclude=https://evil.test'))
    expect(response.headers.get('location')).toBe('https://example.com/obras/primera')
  })
})
