import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from './route'

const TAG =
  '!function(){(new Image).src="https://c.clarity.ms/c.gif";t.src="https://scripts.clarity.ms/0.8.70/clarity.js"}({"upload":"https://o.clarity.ms/collect"});'

const call = (handler: typeof GET, url: string, init?: ConstructorParameters<typeof NextRequest>[1]) =>
  handler(new NextRequest(`https://site.test${url}`, init), {
    params: Promise.resolve({ path: url.replace('/monitoring/', '').split('/') }),
  })

const upstream = (body: string | null, headers: Record<string, string> = {}, status = 200) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status, headers: new Headers(headers) })))

afterEach(() => vi.unstubAllGlobals())

describe('/monitoring', () => {
  it('points the tag at this proxy, except for the cookie-sync pixel', async () => {
    upstream(TAG)
    const body = await (await call(GET, '/monitoring/www.clarity.ms/tag/abc')).text()
    expect(body).toContain('"/monitoring/scripts.clarity.ms/0.8.70/clarity.js"')
    expect(body).toContain('"/monitoring/o.clarity.ms/collect"')
    expect(body).toContain('"https://c.clarity.ms/c.gif"')
  })

  it('lets the CDN keep the tag and the script, without their cookies', async () => {
    upstream(TAG, { 'set-cookie': 'CLID=1; domain=www.clarity.ms; path=/' })
    const tag = await call(GET, '/monitoring/www.clarity.ms/tag/abc')
    expect(tag.headers.get('cache-control')).toContain('s-maxage=600')
    expect(tag.headers.get('set-cookie')).toBeNull()

    upstream('/* clarity */', { 'content-type': 'application/javascript' })
    const script = await call(GET, '/monitoring/scripts.clarity.ms/0.8.70/clarity.js')
    expect(script.headers.get('cache-control')).toContain('s-maxage=86400')
  })

  it("doesn't cache a failed tag", async () => {
    upstream('', {}, 503)
    const tag = await call(GET, '/monitoring/www.clarity.ms/tag/abc')
    expect(tag.headers.get('cache-control')).toBeNull()
  })

  it('passes uploads through uncached', async () => {
    upstream(null, { 'set-cookie': 'MUID=1; domain=.clarity.ms; path=/' }, 204)
    const response = await call(POST, '/monitoring/o.clarity.ms/collect', { method: 'POST', body: 'x' })
    expect(response.status).toBe(204)
    expect(response.headers.get('cache-control')).toBeNull()
    expect(response.headers.get('set-cookie')).toBe('MUID=1; path=/')
  })

  it('refuses hosts other than Clarity', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect((await call(GET, '/monitoring/evil.test/x')).status).toBe(404)
    expect(fetch).not.toHaveBeenCalled()
  })
})
