import { describe, expect, it, vi } from 'vitest'
import { getSelfHostedSupabaseHealth, isR2Configured } from './supabase-monitor'

describe('Supabase monitoring', () => {
  it('checks Auth, PostgREST and Storage on the self-hosted API', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    const env = {
      NEXT_PUBLIC_SUPABASE_URL: 'https://api-mundialdecollage.cloud.gvenue.com.ar',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-test',
      SUPABASE_SERVICE_ROLE_KEY: 'service-test',
    }
    await expect(getSelfHostedSupabaseHealth(fetcher, env)).resolves.toEqual({ ok: true, message: null })
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      env.NEXT_PUBLIC_SUPABASE_URL + '/auth/v1/settings',
      env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/artworks?select=id&limit=1',
      env.NEXT_PUBLIC_SUPABASE_URL + '/storage/v1/bucket',
    ])
    expect(fetcher.mock.calls[2][1].headers.apikey).toBe('service-test')
  })

  it('reports a self-hosted service failure without exposing its key', async () => {
    const fetcher = vi.fn().mockImplementation(async (url: string) =>
      new Response(null, { status: url.endsWith('/storage/v1/bucket') ? 503 : 200 }),
    )
    await expect(getSelfHostedSupabaseHealth(fetcher, {
      NEXT_PUBLIC_SUPABASE_URL: 'https://api-mundialdecollage.cloud.gvenue.com.ar',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-test',
      SUPABASE_SERVICE_ROLE_KEY: 'service-test',
    })).resolves.toEqual({ ok: false, message: 'Storage respondió HTTP 503.' })
  })

  it('reports missing Supabase variables', async () => {
    await expect(getSelfHostedSupabaseHealth(vi.fn(), {})).resolves.toEqual({
      ok: false, message: 'Faltan variables de Supabase en GV Cloud.',
    })
  })

  it('only considers a complete R2 configuration healthy', () => {
    expect(isR2Configured({ R2_ACCOUNT_ID: 'a', R2_ACCESS_KEY_ID: 'b', R2_SECRET_ACCESS_KEY: 'c', R2_BUCKET: 'd' })).toBe(true)
    expect(isR2Configured({ R2_ACCOUNT_ID: 'a' })).toBe(false)
  })
})
