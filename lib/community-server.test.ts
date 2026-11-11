import { describe, expect, it } from 'vitest'
import { toFeedPost, type FeedRow } from './community-server'

const id = '11111111-2222-4333-8444-555555555555'
const profile = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

function row(over: Partial<FeedRow> = {}): FeedRow {
  return {
    id,
    kind: 'artwork',
    body: 'Hola',
    created_at: '2026-11-11T18:00:00.000Z',
    like_count: 2,
    comment_count: 1,
    profile_id: profile,
    author_name: 'Ana Pérez',
    author_country: 'AR',
    author_thumb: 'https://cdn.test/thumb.jpg',
    artwork_slug: 'recortes',
    artwork_title: 'Recortes',
    image_url: 'https://cdn.test/obra.jpg',
    image_path: null,
    official: false,
    pinned: false,
    lang: 'es',
    translations: { en: 'Hello' },
    image_alt: null,
    tags: ['retrato'],
    ...over,
  }
}

const publicUrl = (path: string) => `https://cdn.test/posts/${path}`

describe('toFeedPost', () => {
  it('links the artist and the obra, and keeps the original when the language matches', () => {
    const post = toFeedPost(row(), 'es', publicUrl)
    expect(post).toMatchObject({
      body: 'Hola',
      original: null,
      likes: 2,
      imageUrl: 'https://cdn.test/obra.jpg',
      artwork: { slug: 'recortes', href: '/obras/recortes' },
      author: { profileId: profile, name: 'Ana Pérez', href: `/artistas/ana-perez-${profile}` },
    })
  })

  it('serves a translation and keeps the written text for «Ver original»', () => {
    const post = toFeedPost(row(), 'en', publicUrl)
    expect(post?.body).toBe('Hello')
    expect(post?.original).toBe('Hola')
  })

  it('uses the bucket url for a photo and hides a non-public official author', () => {
    const post = toFeedPost(row({
      kind: 'photo',
      artwork_slug: null,
      artwork_title: null,
      image_url: null,
      image_path: `${profile}/foto.jpg`,
      official: true,
    }), 'es', publicUrl)
    expect(post).toMatchObject({
      imageUrl: `https://cdn.test/posts/${profile}/foto.jpg`,
      artwork: null,
      official: true,
      author: { profileId: '', href: '' },
    })
  })
})
