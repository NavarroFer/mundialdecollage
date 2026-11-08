import { describe, expect, it } from 'vitest'
import { ARTIST_COMMENTS_SHOWN, buildArtistSocial } from './artist-social'

const artworks = [{ id: 'a1', slug: 'primera' }, { id: 'a2', slug: 'segunda' }]

describe('buildArtistSocial', () => {
  it('adds up likes and comments across every obra, zero when there are none', () => {
    const social = buildArtistSocial(artworks, [{ artworkId: 'a1', likes: 4, comments: 2 }], [])
    expect(social.artworks).toEqual({ primera: { likes: 4, comments: 2 }, segunda: { likes: 0, comments: 0 } })
    expect(social.totals).toEqual({ likes: 4, comments: 2 })
  })

  it('lists the newest comments first, tagged with their obra, and drops unknown obras', () => {
    const social = buildArtistSocial(artworks, [], [
      { id: 'c1', artwork_id: 'a1', author_name: 'Ana', body: 'Hermosa', created_at: '2026-11-01T10:00:00Z' },
      { id: 'c2', artwork_id: 'a2', author_name: 'Beto', body: 'Wow', created_at: '2026-11-03T10:00:00Z' },
      { id: 'c3', artwork_id: 'otra', author_name: 'Caro', body: '?', created_at: '2026-11-04T10:00:00Z' },
    ])
    expect(social.comments.map((comment) => [comment.id, comment.artworkSlug])).toEqual([['c2', 'segunda'], ['c1', 'primera']])
    expect(social.comments[0]).not.toHaveProperty('email')
  })

  it('keeps at most the comments the profile shows', () => {
    const rows = Array.from({ length: ARTIST_COMMENTS_SHOWN + 5 }, (_, i) => ({
      id: `c${i}`, artwork_id: 'a1', author_name: 'Ana', body: 'Linda', created_at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
    }))
    expect(buildArtistSocial(artworks, [], rows).comments).toHaveLength(ARTIST_COMMENTS_SHOWN)
  })
})
