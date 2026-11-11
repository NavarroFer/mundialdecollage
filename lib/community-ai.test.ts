import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ maybeSingle: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mocks.maybeSingle }),
      }),
    }),
  }),
}))

import { communityAiBlocks, isCommunityModerationOn, parseArtworkTags, parseCommunityReading } from './community-ai'

describe('parseCommunityReading', () => {
  it('keeps a translation, a known tag and a verdict', () => {
    const reading = parseCommunityReading(JSON.stringify({
      lang: 'es',
      translations: { en: 'Hello', nope: 'x', es: 'ignored' },
      imageAlt: 'Una mesa de trabajo',
      tags: ['retrato', 'inventado', 'retrato', 'luz'],
      verdict: 'ok',
      reason: 'es collage',
    }), { translate: true, describe: true, moderate: true })
    expect(reading.lang).toBe('es')
    expect(reading.translations).toEqual({ en: 'Hello' })
    expect(reading.imageAlt).toBe('Una mesa de trabajo')
    expect(reading.tags).toEqual(['retrato', 'luz'])
    expect(reading.verdict).toBe('ok')
  })

  it('is empty when the model replies with something that is not JSON', () => {
    expect(parseCommunityReading('nope', { translate: true, describe: true, moderate: true })).toMatchObject({
      lang: null, tags: [], verdict: null,
    })
  })

  it('drops a translation and a verdict the caller did not ask for', () => {
    const reading = parseCommunityReading(JSON.stringify({
      lang: 'es', translations: { en: 'Hello' }, imageAlt: 'Mesa', tags: ['taller'], verdict: 'rechazar', reason: 'spam',
    }), { translate: false, describe: false, moderate: false })
    expect(reading.translations).toEqual({})
    expect(reading.imageAlt).toBeNull()
    expect(reading.verdict).toBeNull()
    expect(reading.tags).toEqual(['taller'])
  })
})

describe('parseArtworkTags', () => {
  it('keeps the tags of a valid payload', () => {
    expect(parseArtworkTags('{"tags":["recorte","papel","luz"]}')).toEqual(['recorte', 'papel', 'luz'])
  })

  it('finds the JSON inside surrounding text', () => {
    expect(parseArtworkTags('Claro, acá va:\n{"tags":["ciudad","noche"]}\nEspero que sirva.')).toEqual(['ciudad', 'noche'])
  })

  it('drops tags outside the vocabulary and stops at six', () => {
    expect(parseArtworkTags(JSON.stringify({
      tags: ['retrato', 'inventado', 'Retrato', 'luz', 'mar', 'viaje', 'casa', 'infancia'],
    }))).toEqual(['retrato', 'luz', 'mar', 'viaje', 'casa', 'infancia'])
  })

  it('is empty when the payload is broken', () => {
    expect(parseArtworkTags('no es json')).toEqual([])
    expect(parseArtworkTags('{"tags":')).toEqual([])
    expect(parseArtworkTags('{"tags":"retrato"}')).toEqual([])
  })
})

describe('isCommunityModerationOn', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    mocks.maybeSingle.mockReset()
  })

  it('stays off when the server forces it off, without reading the switch', async () => {
    vi.stubEnv('COMMUNITY_AI', 'off')
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    expect(communityAiBlocks()).toEqual({ env: true, key: false })
    expect(await isCommunityModerationOn()).toBe(false)
    expect(mocks.maybeSingle).not.toHaveBeenCalled()

    vi.stubEnv('COMMUNITY_AI', '')
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    expect(communityAiBlocks()).toEqual({ env: false, key: true })
    expect(await isCommunityModerationOn()).toBe(false)
  })

  it('follows the saved switch only when the server allows the model', async () => {
    vi.stubEnv('COMMUNITY_AI', '')
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    mocks.maybeSingle.mockResolvedValueOnce({ data: { ai_moderation: false }, error: null })
    expect(await isCommunityModerationOn()).toBe(false)
    mocks.maybeSingle.mockResolvedValueOnce({ data: { ai_moderation: true }, error: null })
    expect(await isCommunityModerationOn()).toBe(true)
    mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'down' } })
    expect(await isCommunityModerationOn()).toBe(false)
  })
})
