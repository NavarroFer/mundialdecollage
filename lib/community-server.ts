// Turns a community_feed / community_post / community_highlights row into the
// public FeedPost. Official posts drop the author's profile id: that profile
// is not public, and an auth id must not reach the browser.
import { artistProfileSlug } from '@/lib/artist-slug'
import { type FeedPost, type PostKind, isUuid } from '@/lib/community'

export type FeedRow = {
  id: string
  kind: string
  body: string
  created_at: string
  like_count: number
  comment_count: number
  profile_id: string
  author_name: string | null
  author_country: string | null
  author_thumb: string | null
  artwork_slug: string | null
  artwork_title: string | null
  image_url: string | null
  image_path: string | null
  official: boolean
  pinned: boolean
  lang: string | null
  translations: unknown
  image_alt: string | null
  tags: string[] | null
}

const KINDS = new Set<PostKind>(['artwork', 'souvenir', 'photo'])

function translation(value: unknown, lang: string): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const text = (value as Record<string, unknown>)[lang]
  return typeof text === 'string' && text.trim() ? text : null
}

export function toFeedPost(row: FeedRow, lang: string, publicUrl: (path: string) => string): FeedPost | null {
  if (!isUuid(row.id) || !KINDS.has(row.kind as PostKind)) return null
  const written = row.body ?? ''
  const translated = row.lang && lang !== row.lang ? translation(row.translations, lang) : null
  const name = row.author_name?.trim() || ''
  const official = Boolean(row.official)
  const slug = row.artwork_slug
  const imageUrl = row.kind === 'artwork'
    ? (row.image_url ?? '')
    : (row.image_path ? publicUrl(row.image_path) : '')
  return {
    id: row.id,
    kind: row.kind as PostKind,
    body: translated ?? written,
    createdAt: row.created_at,
    likes: row.like_count ?? 0,
    comments: row.comment_count ?? 0,
    author: official
      ? { profileId: '', name: '', countryCode: null, thumbUrl: null, href: '' }
      : {
          profileId: row.profile_id,
          name,
          countryCode: row.author_country,
          thumbUrl: row.author_thumb,
          href: row.profile_id ? `/artistas/${artistProfileSlug(name, row.profile_id)}` : '',
        },
    imageUrl,
    imageAlt: row.image_alt,
    artwork: slug ? { slug, title: row.artwork_title, href: `/obras/${slug}` } : null,
    official,
    pinned: Boolean(row.pinned),
    tags: Array.isArray(row.tags) ? row.tags : [],
    original: translated ? written : null,
  }
}
