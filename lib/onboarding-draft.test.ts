import { describe, expect, it } from 'vitest'
import { hasContent, parseDraft } from './onboarding-draft'

const stored = (scope: string, draft: unknown) => JSON.stringify({ scope, draft })
const defaults = { name: 'Ana', country: 'AR', instagram: '', website: '' }

describe('parseDraft', () => {
  it('brings back a draft saved for the same account and mode', () => {
    const draft = parseDraft(stored('user-1', { name: 'Ana Pérez', country: 'UY', instagram: '@ana', website: '', artworks: [{ title: 'Mar', technique: 'Analógica' }] }), 'user-1')
    expect(draft).toEqual({ name: 'Ana Pérez', country: 'UY', instagram: '@ana', website: '', artworks: [{ title: 'Mar', technique: 'Analógica' }] })
  })

  it("ignores another account's or mode's draft, and broken storage", () => {
    expect(parseDraft(stored('user-2', { name: 'Otra' }), 'user-1')).toBeNull()
    expect(parseDraft(stored('user-1', { name: 'Ana' }), 'user-1:another')).toBeNull()
    expect(parseDraft('{not json', 'user-1')).toBeNull()
    expect(parseDraft(null, 'user-1')).toBeNull()
  })

  it('keeps at least one obra and drops what is not text', () => {
    expect(parseDraft(stored('u', { name: 7, artworks: 'x' }), 'u')).toEqual({ name: '', country: '', instagram: '', website: '', artworks: [{ title: '', technique: '' }] })
  })
})

describe('hasContent', () => {
  const empty = { ...defaults, artworks: [{ title: '', technique: '' }] }

  it('is false for a form nobody touched', () => {
    expect(hasContent(empty, defaults)).toBe(false)
  })

  it('is true once a title, a second obra or a changed field is there', () => {
    expect(hasContent({ ...empty, artworks: [{ title: 'Mar', technique: '' }] }, defaults)).toBe(true)
    expect(hasContent({ ...empty, artworks: [{ title: '', technique: '' }, { title: '', technique: '' }] }, defaults)).toBe(true)
    expect(hasContent({ ...empty, country: 'CL' }, defaults)).toBe(true)
  })
})
