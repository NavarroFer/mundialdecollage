import { CORREO_PROVINCES, type CorreoBranch } from './correo-branches'
import provinces from './argentina-provinces.json'

const cache = new Map<string, { expires: number; branches: CorreoBranch[] }>()
const requests = new Map<string, Promise<CorreoBranch[]>>()
let token: { value: string; expires: number } | undefined
let tokenRequest: Promise<string> | undefined
const ttl = 15 * 60 * 1000
const base = () => process.env.CORREO_API_ENV === 'test'
  ? 'https://apitest.correoargentino.com.ar/micorreo/v1'
  : 'https://api.correoargentino.com.ar/micorreo/v1'
export const correoConfigured = () => Boolean(process.env.CORREO_API_USER && process.env.CORREO_API_PASSWORD && process.env.CORREO_CUSTOMER_ID)

async function authorize() {
  if (token && token.expires > Date.now()) return token.value
  if (tokenRequest) return tokenRequest
  tokenRequest = (async () => {
    if (!correoConfigured()) throw new Error('Correo is not configured')
    const response = await fetch(`${base()}/token`, {
      method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${process.env.CORREO_API_USER}:${process.env.CORREO_API_PASSWORD}`).toString('base64')}` },
      cache: 'no-store', signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) throw new Error('Correo authorization unavailable')
    const data = await response.json()
    if (typeof data.token !== 'string' || !data.token) throw new Error('Invalid Correo token')
    // Conservative lifetime; no assumptions about the provider's date timezone.
    token = { value: data.token, expires: Date.now() + 4 * 60 * 1000 }
    return token.value
  })()
  try { return await tokenRequest } finally { tokenRequest = undefined }
}

const string = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const coordinate = (value: unknown, limit: number) => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null
}
export function publicBranch(raw: Record<string, unknown>, provinceCode: string): CorreoBranch | null {
  const services = raw.services as Record<string, unknown> | undefined
  if (raw.status !== 'ACTIVE' || services?.pickupAvailability !== true) return null
  const location = raw.location as Record<string, unknown> | undefined
  const address = location?.address as Record<string, unknown> | undefined
  if (!address || !/^[A-Z0-9_-]{2,20}$/i.test(string(raw.code)) || !string(raw.name) || string(address.provinceCode) !== provinceCode
    || !string(address.streetName) || !(string(address.locality) || string(address.city))
    || !/^([a-z]\d{4}[a-z]{3}|\d{4})$/i.test(string(address.postalCode))) return null
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const hours = raw.hours as Record<string, { start?: unknown; end?: unknown } | null> | undefined
  const format = (time: unknown) => /^\d{4}$/.test(string(time)) ? `${string(time).slice(0, 2)}:${string(time).slice(2)}` : ''
  return {
    code: string(raw.code), name: string(raw.name),
    address: [string(address.streetName), string(address.streetNumber)].filter(Boolean).join(' '),
    city: string(address.city), locality: string(address.locality), province: string(address.province), provinceCode,
    postalCode: string(address.postalCode), latitude: coordinate(location?.latitude, 90), longitude: coordinate(location?.longitude, 180),
    // Day indices are translated by the client; absent schedules are not invented.
    hours: days.flatMap((day, index) => {
      const start = format(hours?.[day]?.start), end = format(hours?.[day]?.end)
      return start && end ? [`${index}:${start}–${end}`] : []
    }).join('|'),
  }
}

export async function getCorreoBranches(provinceCode: string, fresh = false): Promise<CorreoBranch[]> {
  if (!Object.values(CORREO_PROVINCES).includes(provinceCode)) throw new Error('Invalid province')
  const hit = cache.get(provinceCode)
  if (!fresh && hit && hit.expires > Date.now()) return hit.branches
  if (!fresh && requests.has(provinceCode)) return requests.get(provinceCode)!
  const request = (async () => {
    const query = new URLSearchParams({ customerId: process.env.CORREO_CUSTOMER_ID ?? '', provinceCode, services: 'pickup_availability' })
    const access = await authorize()
    let response = await fetch(`${base()}/agencies?${query}`, { headers: { Authorization: `Bearer ${access}` }, cache: 'no-store', signal: AbortSignal.timeout(10000) })
    if (response.status === 401) {
      token = undefined
      response = await fetch(`${base()}/agencies?${query}`, { headers: { Authorization: `Bearer ${await authorize()}` }, cache: 'no-store', signal: AbortSignal.timeout(10000) })
    }
    if (!response.ok) throw new Error('Correo branches unavailable')
    const data: unknown = await response.json()
    if (!Array.isArray(data)) throw new Error('Invalid Correo branch response')
    const branches = data.flatMap((raw) => {
      if (!raw || typeof raw !== 'object') return []
      const branch = publicBranch(raw, provinceCode)
      return branch ? [branch] : []
    })
    cache.set(provinceCode, { expires: Date.now() + ttl, branches })
    return branches
  })()
  if (!fresh) requests.set(provinceCode, request)
  try { return await request } finally { if (!fresh) requests.delete(provinceCode) }
}

export async function resolvePickup(provinceName: string, branchCode: string) {
  const province = provinces.find((p) => p.name === provinceName)
  const code = province && CORREO_PROVINCES[province.id]
  if (!code || !/^[A-Z0-9_-]{2,20}$/i.test(branchCode)) return null
  // Revalidate with Correo before any payment or subscription is created.
  return (await getCorreoBranches(code, true)).find((branch) => branch.code === branchCode) ?? null
}

const quotes = new Map<string, { expires: number; fee: number }>()
const quoteRequests = new Map<string, Promise<number>>()

/** Physical package dimensions must be configured from actual packed products. */
export async function quoteSubscriptionShipping(plan: string, branch: CorreoBranch) {
  // Temporary merchant tariff until the MiCorreo rate integration is enabled.
  if (process.env.CORREO_SHIPPING_RATE_MODE !== 'api') {
    const fee = Number(process.env.CORREO_FLAT_SHIPPING_FEE ?? '7000')
    if (!Number.isFinite(fee) || fee <= 0) throw new Error('Invalid fixed shipping fee')
    return Math.round(fee * 100) / 100
  }
  const origin = process.env.CORREO_ORIGIN_POSTAL_CODE
  let dimensions: { weight: number; height: number; width: number; length: number }
  try { dimensions = JSON.parse(process.env.CORREO_PACKAGES_JSON ?? '{}')[plan] } catch { throw new Error('Package configuration unavailable') }
  if (!origin || !/^([a-z]\d{4}[a-z]{3}|\d{4})$/i.test(origin) || !dimensions
    || !['weight', 'height', 'width', 'length'].every((key) => Number.isInteger(dimensions[key as keyof typeof dimensions]) && dimensions[key as keyof typeof dimensions] > 0)
    || dimensions.weight > 25000 || [dimensions.height, dimensions.width, dimensions.length].some((n) => n > 150)) throw new Error('Package configuration unavailable')
  const destination = branch.postalCode.match(/\d{4}/)?.[0]
  if (!destination) throw new Error('Invalid branch postal code')
  const key = JSON.stringify([origin, destination, dimensions])
  const previous = quotes.get(key)
  if (previous && previous.expires > Date.now()) return previous.fee
  if (quoteRequests.has(key)) return quoteRequests.get(key)!
  const task = (async () => {
    const response = await fetch(`${base()}/rates`, {
      method: 'POST', headers: { Authorization: `Bearer ${await authorize()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: process.env.CORREO_CUSTOMER_ID, postalCodeOrigin: origin.match(/\d{4}/)![0], postalCodeDestination: destination, deliveredType: 'S', dimensions }),
      cache: 'no-store', signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) throw new Error('Shipping quote unavailable')
    const data = await response.json()
    const rate = Array.isArray(data.rates) ? data.rates.find((r: { deliveredType: string; productType: string }) => r.deliveredType === 'S' && r.productType === 'CP') : null
    if (!rate || typeof rate.price !== 'number' || !Number.isFinite(rate.price) || rate.price <= 0) throw new Error('Invalid shipping quote')
    const fee = Math.round(rate.price * 100) / 100
    const providerExpiry = Date.parse(data.validTo)
    if (Number.isFinite(providerExpiry) && providerExpiry <= Date.now()) throw new Error('Expired shipping quote')
    quotes.set(key, { expires: Math.min(Date.now() + ttl, Number.isFinite(providerExpiry) ? providerExpiry : Date.now() + ttl), fee })
    return fee
  })()
  quoteRequests.set(key, task)
  try { return await task } finally { quoteRequests.delete(key) }
}
