import { withReferral } from '@/lib/referral'

// Comunidad (docs/red-social.md). Pure helpers shared by the CDN feed and the
// server actions. No server imports: Vitest and the browser can both load it.

/** Where a card links. The obra's ?ref= rides along when the author has one. */
export function communityPostPath(id: string, artworkSlug?: string | null): string {
  const base = artworkSlug ? withReferral('/comunidad', artworkSlug) : '/comunidad'
  return `${base}#post-${id}`
}

export const POST_BODY_MAX = 1000
export const COMMENT_BODY_MAX = 500
export const FEED_PAGE_SIZE = 20
export const STRIP_MIN_POSTS = 6
export const POSTS_BUCKET = 'posts'
export const STRIP_SIZE = 6

export const FEED_CACHE = 'public, s-maxage=60, stale-while-revalidate=600'
export const INVALID_CACHE = 'public, s-maxage=3600'
export const ERROR_CACHE = 'no-store'

export type PostKind = 'artwork' | 'souvenir' | 'photo'

/** What /api/comunidad sends: same bytes for everyone, nothing personal. */
export type FeedPost = {
  id: string
  kind: PostKind
  body: string
  createdAt: string
  likes: number
  comments: number
  author: { profileId: string; name: string; countryCode: string | null; thumbUrl: string | null; href: string }
  imageUrl: string
  /** Written later by AI; the card falls back to «Foto de {name}». */
  imageAlt: string | null
  artwork: { slug: string; title: string | null; href: string } | null
  /** «Mundial de Collage»: logo instead of a thumb, no profile link. */
  official: boolean
  /** The week's prompt. */
  pinned: boolean
  /** Fixed vocabulary. The browser ranks «Para vos» with these (stage 4). */
  tags: string[]
  /**
   * `body` is already in the language asked for (`?lang=`). `original` is the
   * text as written when a translation was used, for «Ver original».
   */
  original: string | null
}

export type FeedPage = { posts: FeedPost[]; next: string | null }

export type CommunityError =
  | 'signin'
  | 'not_artist'
  | 'not_found'
  | 'already'
  | 'rate_limited'
  | 'too_long'
  | 'bad_image'
  | 'unavailable'

export type CommunityViewer = {
  signedIn: boolean
  canPost: boolean
  liked: string[]
  mine: string[]
  artworkPostId: string | null
  /** Their published obra, when it isn't on Comunidad yet. */
  unpostedArtworkSlug: string | null
  /** Tag → weight. Empty until there is enough to read a taste (stage 4). */
  taste: Record<string, number>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const POST_PATH = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(jpg|png|webp)$/i

export function isUuid(value: string): boolean {
  return UUID.test(value)
}

/** `<created_at ISO>_<uuid>`; null when it doesn't parse. */
export function encodeCursor(createdAt: string, id: string): string {
  return `${createdAt}_${id}`
}

export function decodeCursor(value: string | null): { at: string; id: string } | null {
  if (!value) return null
  const split = value.lastIndexOf('_')
  if (split <= 0) return null
  const at = value.slice(0, split)
  const id = value.slice(split + 1)
  if (!UUID.test(id) || Number.isNaN(Date.parse(at))) return null
  return { at: new Date(at).toISOString(), id: id.toLowerCase() }
}

/** Trims and validates a post or comment body. Null when it isn't text or is too long. */
export function cleanBody(value: unknown, max: number): string | null {
  if (value == null) return ''
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length > max) return null
  return trimmed
}

/** `${userId}/${uuid}.(jpg|png|webp)`, the only paths a post may point to. */
export function isOwnPostPath(path: string, userId: string): boolean {
  const match = POST_PATH.exec(path)
  return Boolean(match && match[1].toLowerCase() === userId.toLowerCase())
}

export type FeedQuery = {
  cursor: { at: string; id: string } | null
  author: string | null
  limit: number
  lang: string
  highlights: boolean
}

/** The public query string. Invalid values are a 400, never a guess. */
export function parseFeedQuery(params: URLSearchParams): FeedQuery | null {
  const highlights = params.get('destacadas') === '1'
  const antes = params.get('antes')
  const cursor = antes == null || highlights ? null : decodeCursor(antes)
  if (antes != null && !highlights && !cursor) return null

  const autor = params.get('autor')
  if (autor != null && !isUuid(autor)) return null

  const rawLimit = params.get('n')
  let limit = FEED_PAGE_SIZE
  if (rawLimit != null) {
    if (!/^\d+$/.test(rawLimit)) return null
    limit = Number(rawLimit)
    if (limit < 1 || limit > FEED_PAGE_SIZE) return null
  }

  const lang = params.get('lang')
  if (lang != null && !/^[a-z]{2}$/.test(lang)) return null

  return { cursor, author: autor?.toLowerCase() ?? null, limit, lang: lang ?? 'es', highlights }
}
