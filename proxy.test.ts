import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LOCALE_COOKIE } from '@/lib/i18n/locales'
import { REFERRAL_COOKIE } from '@/lib/referral'
import { config, proxy } from './proxy'

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn(async () => ({ data: { user: null } })) }))
vi.mock('@supabase/ssr', () => ({ createServerClient: vi.fn(() => ({ auth: { getUser } })) }))
vi.mock('@/lib/supabase/config', () => ({ isSupabaseConfigured: true }))

const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url })

// Where the proxy sends a request: the rewritten path, or null if untouched.
const served = async (path: string, headers: Record<string, string> = {}) => {
  const response = await proxy(new NextRequest(`https://site.test${path}`, { headers }))
  const rewrite = response.headers.get('x-middleware-rewrite')
  return rewrite ? new URL(rewrite).pathname + new URL(rewrite).search : null
}

afterEach(() => getUser.mockClear())

describe('proxy matcher', () => {
  it('runs for pages', () => {
    for (const url of ['/', '/obras/una-obra', '/onboarding', '/admin', '/auth/callback', '/galeria-3d', '/obras/una-obra/historia']) {
      expect(matches(url), url).toBe(true)
    }
  })

  it('skips what never reads the session', () => {
    for (const url of [
      '/api/img',
      '/api/track',
      '/api/cron/infra',
      '/monitoring/www.clarity.ms/tag/abc',
      '/es/opengraph-image',
      '/es/anon/obras/una-obra/opengraph-image',
      '/es/icon.png',
      '/_next/webpack-hmr',
      '/_vercel/insights/view',
      '/cancion.mp3',
      '/mundial-de-collage.pdf',
      '/robots.txt',
      '/sitemap.xml',
    ]) {
      expect(matches(url), url).toBe(false)
    }
  })
})

describe('proxy', () => {
  it('serves public pages from their anonymous copy, in the visitor language', async () => {
    expect(await served('/')).toBe('/es/anon')
    expect(await served('/obras/una-obra', { 'accept-language': 'it-IT,it;q=0.9' })).toBe('/it/anon/obras/una-obra')
    expect(await served('/galeria-3d', { 'x-vercel-ip-country': 'BR' })).toBe('/pt/anon/galeria-3d')
    expect(await served('/partners', { cookie: `${LOCALE_COOKIE}=de`, 'accept-language': 'fr' })).toBe('/de/anon/partners')
  })

  it("doesn't touch Supabase for a visitor without a session", async () => {
    await served('/obras/una-obra')
    expect(getUser).not.toHaveBeenCalled()
  })

  it('renders per request for whoever brings something personal', async () => {
    expect(await served('/obras/una-obra', { cookie: 'sb-abc-auth-token=x' })).toBe('/es/obras/una-obra')
    expect(getUser).toHaveBeenCalledOnce()
    expect(await served('/', { cookie: `${REFERRAL_COOKIE}=una-obra` })).toBe('/es')
    expect(await served('/obras/una-obra?ref=otra-obra')).toBe('/es/obras/una-obra?ref=otra-obra')
  })

  it('keeps referral attribution without rendering unrelated public pages per visit', async () => {
    const headers = { cookie: `${REFERRAL_COOKIE}=una-obra` }
    expect(await served('/galeria-3d?ref=una-obra', headers)).toBe('/es/anon/galeria-3d?ref=una-obra')
    expect(await served('/partners', headers)).toBe('/es/anon/partners')
    expect(await served('/onboarding', headers)).toBe('/es/anon/onboarding')
    expect(await served('/?ref=INVALID')).toBe('/es/anon?ref=INVALID')
    expect(getUser).not.toHaveBeenCalled()
  })

  it('uses the CDN for explicit locale URLs while preserving personal renders', async () => {
    expect(await served('/it/obras/una-obra', { 'accept-language': 'en' })).toBe('/it/anon/obras/una-obra')
    expect(await served('/pt')).toBe('/pt/anon')
    expect(await served('/es/partners', { cookie: `${REFERRAL_COOKIE}=una-obra` })).toBe('/es/anon/partners')
    expect(await served('/es/obras/una-obra?ref=una-obra')).toBeNull()
    expect(await served('/es/obras/una-obra', { cookie: 'sb-abc-auth-token=x' })).toBeNull()
    expect(getUser).toHaveBeenCalledOnce()
    expect(await served('/es/obras/una-obra/historia')).toBeNull()
  })

  it('renders pages without an anonymous copy per request', async () => {
    expect(await served('/onboarding/obras')).toBe('/es/onboarding/obras')
    expect(await served('/tienda')).toBe('/es/tienda')
    expect(await served('/admin')).toBe('/es/admin')
  })

  it('leaves a localized URL as it is', async () => {
    expect(await served('/es/anon/obras/una-obra')).toBeNull()
  })

  it('still turns a ?lang= link into the language cookie', async () => {
    const response = await proxy(new NextRequest('https://site.test/partners?lang=it'))
    expect(response.headers.get('location')).toBe('https://site.test/partners')
    expect(response.cookies.get(LOCALE_COOKIE)?.value).toBe('it')
  })
})
