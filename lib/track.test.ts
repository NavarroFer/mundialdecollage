import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const vid = '550e8400-e29b-41d4-a716-446655440000'
let beacon: ReturnType<typeof vi.fn>
let listeners: Record<string, () => void>
let visibility: 'visible' | 'hidden'
let jar: string[]
let userAgent: string

// A fresh module per test: the queue lives at module level.
async function load() {
  vi.resetModules()
  return import('./track')
}
const sentBatches = () => beacon.mock.calls.map(([, blob]) => blob as Blob)
const bodies = async () => Promise.all(sentBatches().map(async (blob) => JSON.parse(await blob.text())))

beforeEach(() => {
  vi.useFakeTimers()
  beacon = vi.fn(() => true)
  listeners = {}
  visibility = 'visible'
  jar = [`mdc-vid=${vid}`]
  userAgent = 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
  const on = (type: string, listener: () => void) => { listeners[type] = listener }
  vi.stubGlobal('navigator', { sendBeacon: beacon, get userAgent() { return userAgent } })
  vi.stubGlobal('window', { addEventListener: on, location: { href: 'https://mundialdecollage.com.ar/' } })
  // A cookie jar like the browser's: setting one cookie keeps the others.
  vi.stubGlobal('document', {
    get cookie() { return jar.join('; ') },
    set cookie(value: string) {
      const pair = value.split(';')[0]
      jar = [...jar.filter((entry) => !entry.startsWith(`${pair.split('=')[0]}=`)), pair]
    },
    referrer: '',
    addEventListener: on,
    get visibilityState() { return visibility },
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('track', () => {
  it('sends the steps of the first seconds together, in one call', async () => {
    const { track } = await load()
    track('home_view')
    track('hero_cta_view')
    expect(beacon).not.toHaveBeenCalled()
    vi.advanceTimersByTime(5000)
    expect(await bodies()).toEqual([{ names: ['home_view', 'hero_cta_view'], vid, inApp: null }])
  })

  it('sends what is queued as soon as the page is hidden or left', async () => {
    const { track } = await load()
    track('sign_in_start')
    visibility = 'hidden'
    listeners.visibilitychange()
    track('gallery_view')
    listeners.pagehide()
    expect(await bodies()).toEqual([{ names: ['sign_in_start'], vid, inApp: null }, { names: ['gallery_view'], vid, inApp: null }])
    vi.advanceTimersByTime(5000)
    expect(beacon).toHaveBeenCalledTimes(2)
  })

  it("doesn't wait once a batch is full", async () => {
    const { track } = await load()
    for (let i = 0; i < 20; i++) track('artwork_open')
    expect(beacon).toHaveBeenCalledOnce()
    expect((await bodies())[0].names).toHaveLength(20)
  })

  it('falls back to fetch when the beacon is refused', async () => {
    beacon.mockReturnValue(false)
    const fetch = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    const { track } = await load()
    track('home_view')
    vi.advanceTimersByTime(5000)
    expect(fetch).toHaveBeenCalledWith('/api/track', expect.objectContaining({ method: 'POST', keepalive: true, body: JSON.stringify({ names: ['home_view'], vid, inApp: null }) }))
  })

  it("says which app's browser sent the steps, and remembers where the visit came from", async () => {
    userAgent = 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile/15E148 Instagram 350.0.0.0'
    const { track } = await load()
    track('home_view')
    vi.advanceTimersByTime(5000)
    expect(await bodies()).toEqual([{ names: ['home_view'], vid, inApp: 'instagram' }])
    expect(jar).toContain('mdc-src=instagram')
  })

  it('keeps the first origin it saw', async () => {
    jar.push('mdc-src=google')
    const { track } = await load()
    track('home_view')
    expect(jar).toContain('mdc-src=google')
    expect(jar).not.toContain('mdc-src=direct')
  })
})
