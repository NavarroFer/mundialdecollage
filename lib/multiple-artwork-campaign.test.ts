import { describe, expect, it, vi } from 'vitest'
import { audienceContacts, parseAudience } from './campaign-audience'
import { campaignRecipientValues } from './campaign-delivery'
import { personalizeHtmlWithValues, renderEmailDocumentToHtml } from './email-blocks'
import { SYSTEM_TEMPLATES } from './system-templates'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('./mail', () => ({ sendMails: vi.fn() }))

describe('multiple artwork campaign', () => {
  it('recognizes its audience and intersects it with subscribers, excluding admins', async () => {
    expect(parseAudience('multiple_artworks')).toBe('multiple_artworks')
    const db = {
      from: () => ({ select: () => ({ eq: async () => ({ data: [
        { id: 'artist', email: 'artist@example.com', name: 'Ana' },
        { id: 'single', email: 'single@example.com', name: null },
        { id: 'admin', email: 'mundialdecollage@gmail.com', name: null },
      ], error: null }) }) }),
      rpc: async () => ({ data: [
        { contact_id: 'artist', artwork_titles: ['Mar', null] },
        { contact_id: 'unsubscribed', artwork_titles: ['A', 'B'] },
        { contact_id: 'admin', artwork_titles: ['A', 'B'] },
      ], error: null }),
    } as unknown as SupabaseClient
    expect((await audienceContacts(db, 'multiple_artworks')).contacts.map(c => c.id)).toEqual(['artist'])
  })
  it('never falls back to all subscribers when the audience lookup fails', async () => {
    const db = {
      from: () => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }) }),
      rpc: async () => ({ data: null, error: { message: 'unavailable' } }),
    } as unknown as SupabaseClient
    expect(await audienceContacts(db, 'multiple_artworks')).toEqual({ contacts: [], error: 'unavailable' })
  })
  it('lists each title safely, preserves untitled works, and links to registration', () => {
    const values = campaignRecipientValues({ id: '1', email: 'a@example.com', name: 'Ana', locale: 'es', artworkTitles: ['<Mar & sol>', null] })
    const html = personalizeHtmlWithValues(renderEmailDocumentToHtml(SYSTEM_TEMPLATES.elegir_obra.createDocument('https://example.com')), values)
    expect(html).toContain('2 obras')
    expect(html).toContain('1. &lt;Mar &amp; sol&gt; • 2. Sin título')
    expect(html).toContain('https://example.com/onboarding')
    expect(html).not.toContain('{{')
  })
})
