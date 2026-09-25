import { describe, expect, it } from 'vitest'
import { commentsHtml, digestWindow, fillDigestTags, planArtistDigests, type DigestRow } from './artist-digest'

function row(overrides: Partial<DigestRow>): DigestRow {
  return {
    profile_id: 'p1', artist_name: 'Ana', country_code: 'AR', email: 'ana@example.com', contact_id: 'c1',
    subscribed: true, artwork_title: 'Obra', artwork_slug: 'obra', likes_window: 3, likes_total: 10, comments: [],
    ...overrides,
  }
}

describe('digestWindow', () => {
  it('covers the exhibition day that just ended (09:00 → 09:00 Argentina)', () => {
    const { start, end, day } = digestWindow(new Date('2026-09-26T12:05:00Z'))
    expect(start.toISOString()).toBe('2026-09-25T12:00:00.000Z')
    expect(end.toISOString()).toBe('2026-09-26T12:00:00.000Z')
    expect(day).toBe('2026-09-25')
  })

  it('before 09:00 Argentina, the day before that', () => {
    expect(digestWindow(new Date('2026-09-26T11:59:00Z')).day).toBe('2026-09-24')
  })
})

describe('planArtistDigests', () => {
  it('mails each reachable artist once, in their language', () => {
    const { send, skip } = planArtistDigests([
      row({}),
      row({ artwork_slug: 'otra' }),
      row({ profile_id: 'p2', email: 'bia@example.com', contact_id: 'c2', country_code: 'BR' }),
      row({ profile_id: 'p3', subscribed: false }),
    ])
    expect(send.map((r) => [r.profile_id, r.locale])).toEqual([['p1', 'es'], ['p2', 'pt']])
    expect(skip.map((s) => s.reason)).toEqual(['Se dio de baja'])
  })
})

describe('digest tags', () => {
  it('fills counts and escaped comments', () => {
    const html = fillDigestTags('{{likes}} / {{ likes_total }} — {{comentarios}}', row({
      comments: [{ author: 'Luz <3', body: 'Hermosa & viva' }],
    }))
    expect(html).toBe('3 / 10 — «Hermosa &amp; viva» — <strong>Luz &lt;3</strong>')
  })

  it('separates several comments', () => {
    expect(commentsHtml([{ author: 'A', body: 'x' }, { author: 'B', body: 'y' }])).toContain('<br /><br />')
  })
})
