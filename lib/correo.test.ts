import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { branchDistance, searchBranches } from './correo-branches'
import { publicBranch } from './correo'

const raw = {
  code: 'B0107', name: 'Monte Grande', status: 'ACTIVE', services: { pickupAvailability: true },
  email: 'staff@example.com', manager: 'Private contact',
  location: { address: { streetName: 'Vicente López', streetNumber: '448', locality: 'Monte Grande', city: 'Esteban Echeverría', province: 'Buenos Aires', provinceCode: 'B', postalCode: '1842' }, latitude: '-34.8194', longitude: '-58.4674' },
  hours: { monday: { start: '0930', end: '1800' } },
}
const branch = publicBranch(raw, 'B')!

describe('branch catalogue', () => {
  it('excludes inactive branches, pickup-disabled branches and other provinces', () => {
    expect(publicBranch({ ...raw, status: 'INACTIVE' }, 'B')).toBeNull()
    expect(publicBranch({ ...raw, services: { pickupAvailability: false } }, 'B')).toBeNull()
    expect(publicBranch(raw, 'C')).toBeNull()
  })
  it('does not expose staff details and preserves useful hours and address', () => {
    expect(branch).toMatchObject({ code: 'B0107', address: 'Vicente López 448', hours: '0:09:30–18:00' })
    expect(branch).not.toHaveProperty('email')
    expect(branch).not.toHaveProperty('manager')
  })
  it('finds accented names, localities, addresses and postal codes', () => {
    expect(searchBranches([branch], 'echeverria')).toEqual([branch])
    expect(searchBranches([branch], '1842')).toEqual([branch])
    expect(searchBranches([branch], 'lopez 448')).toEqual([branch])
    expect(searchBranches([branch], 'Rosario')).toEqual([])
  })
  it('handles missing coordinates without suggesting a zero-distance branch', () => {
    expect(publicBranch({ ...raw, location: { ...raw.location, latitude: '', longitude: null } }, 'B')).toMatchObject({ latitude: null, longitude: null })
    expect(branchDistance({ ...branch, latitude: null }, { latitude: 0, longitude: 0 })).toBeNull()
    expect(branchDistance(branch, { latitude: branch.latitude!, longitude: branch.longitude! })).toBeCloseTo(0)
  })
})

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('CORREO_API_USER', 'api-user')
  vi.stubEnv('CORREO_API_PASSWORD', 'api-secret')
  vi.stubEnv('CORREO_CUSTOMER_ID', 'customer')
  vi.stubEnv('CORREO_API_ENV', 'test')
  vi.stubEnv('CORREO_ORIGIN_POSTAL_CODE', '7600')
  vi.stubEnv('CORREO_PACKAGES_JSON', JSON.stringify({ inicial: { weight: 500, height: 5, width: 20, length: 25 } }))
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('official API and tariff', () => {
  it('keeps credentials server-side, reuses requests, and quotes branch delivery with actual dimensions', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ token: 'access' }))
      .mockResolvedValueOnce(Response.json([raw]))
      .mockResolvedValueOnce(Response.json({ rates: [{ deliveredType: 'D', productType: 'CP', price: 9000 }, { deliveredType: 'S', productType: 'CP', price: 4200.25 }], validTo: new Date(Date.now() + 600000).toISOString() }))
    vi.stubGlobal('fetch', fetch)
    const correo = await import('./correo')
    const [one, two] = await Promise.all([correo.getCorreoBranches('B'), correo.getCorreoBranches('B')])
    expect(one).toEqual(two)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(await correo.quoteSubscriptionShipping('inicial', one[0])).toBe(4200.25)
    expect(await correo.quoteSubscriptionShipping('inicial', one[0])).toBe(4200.25)
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toMatchObject({ deliveredType: 'S', postalCodeOrigin: '7600', postalCodeDestination: '1842', dimensions: { weight: 500, height: 5, width: 20, length: 25 } })
    expect(JSON.stringify(one)).not.toContain('api-secret')
  })
  it('fails closed for missing physical package configuration or bad prices', async () => {
    vi.stubEnv('CORREO_PACKAGES_JSON', '{}')
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    const correo = await import('./correo')
    await expect(correo.quoteSubscriptionShipping('inicial', branch)).rejects.toThrow('configuration')
    expect(fetch).not.toHaveBeenCalled()
    vi.stubEnv('CORREO_PACKAGES_JSON', JSON.stringify({ inicial: { weight: 500, height: 5, width: 20, length: 25 } }))
    fetch.mockResolvedValueOnce(Response.json({ token: 'access' })).mockResolvedValueOnce(Response.json({ rates: [{ deliveredType: 'S', productType: 'CP', price: -1 }] }))
    await expect(correo.quoteSubscriptionShipping('inicial', branch)).rejects.toThrow('Invalid shipping quote')
  })
  it('revalidates an inactive selected branch before checkout despite a previously cached result', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ token: 'access' })).mockResolvedValueOnce(Response.json([raw])).mockResolvedValueOnce(Response.json([{ ...raw, status: 'INACTIVE' }]))
    vi.stubGlobal('fetch', fetch)
    const correo = await import('./correo')
    expect(await correo.getCorreoBranches('B')).toHaveLength(1)
    expect(await correo.resolvePickup('Buenos Aires', 'B0107')).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(3)
  })
  it('rejects unknown provinces without calling Correo', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    const correo = await import('./correo')
    await expect(correo.getCorreoBranches('invalid')).rejects.toThrow('Invalid province')
    expect(fetch).not.toHaveBeenCalled()
  })
})
