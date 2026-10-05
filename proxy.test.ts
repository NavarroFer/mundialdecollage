import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LOCALE_COOKIE } from '@/lib/i18n/locales'
import { config, proxy } from './proxy'

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn(async () => ({ data: { user: null } })) }))
vi.mock('@supabase/ssr', () => ({ createServerClient: vi.fn(() => ({ auth: { getUser } })) }))
vi.mock('@/lib/supabase/config', () => ({ isSupabaseConfigured: true }))

const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url })

afterEach(() => getUser.mockClear())

describe('proxy matcher', () => {
  it('runs for pages', () => {
    for (const url of ['/', '/obras/una-obra', '/onboarding', '/admin', '/auth/callback', '/galeria-3d']) {
      expect(matches(url), url).toBe(true)
    }
  })

  it('skips what never reads the session', () => {
    for (const url of [
      '/api/img',
      '/api/track',
      '/api/cron/infra',
      '/monitoring/www.clarity.ms/tag/abc',
      '/opengraph-image',
      '/obras/una-obra/opengraph-image',
      '/cancion.mp3',
      '/mundial-de-collage.pdf',
      '/robots.txt',
      '/sitemap.xml',
      '/icon.png',
    ]) {
      expect(matches(url), url).toBe(false)
    }
  })
})

describe('proxy', () => {
  it("doesn't touch Supabase for a visitor without a session", async () => {
    await proxy(new NextRequest('https://site.test/obras/una-obra'))
    expect(getUser).not.toHaveBeenCalled()
  })

  it('refreshes the session when there is one', async () => {
    const request = new NextRequest('https://site.test/obras/una-obra', {
      headers: { cookie: 'sb-abc-auth-token=x' },
    })
    await proxy(request)
    expect(getUser).toHaveBeenCalledOnce()
  })

  it('still turns a ?lang= link into the language cookie', async () => {
    const response = await proxy(new NextRequest('https://site.test/partners?lang=it'))
    expect(response.headers.get('location')).toBe('https://site.test/partners')
    expect(response.cookies.get(LOCALE_COOKIE)?.value).toBe('it')
  })
})
