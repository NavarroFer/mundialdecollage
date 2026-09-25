import { describe, expect, it } from 'vitest'
import { safeNextUrl } from './safe-next'

const origin = 'https://mundialdecollage.com.ar'

describe('safeNextUrl', () => {
  it('keeps paths on this site, query included', () => {
    expect(safeNextUrl('/galeria-3d?obra=x&accion=like', origin)).toBe(`${origin}/galeria-3d?obra=x&accion=like`)
  })

  it('never leaves the site', () => {
    for (const next of ['@evil.com', '//evil.com', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)']) {
      expect(safeNextUrl(next, origin)).toBe(`${origin}/onboarding`)
    }
  })

  it('defaults to onboarding', () => {
    expect(safeNextUrl(null, origin)).toBe(`${origin}/onboarding`)
  })
})
