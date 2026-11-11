import { withReferral } from '@/lib/referral'

// Comunidad (docs/red-social.md). Pure helpers shared by the CDN feed and the
// server actions. No server imports: Vitest and the browser can both load it.

/** Where a card links. The obra's ?ref= rides along when the author has one. */
export function communityPostPath(id: string, artworkSlug?: string | null): string {
  const path = `/comunidad/p/${id}`
  return artworkSlug ? withReferral(path, artworkSlug) : path
}

export const POST_BODY_MAX = 1000
export const COMMENT_BODY_MAX = 500
export const FEED_PAGE_SIZE = 20
export const STRIP_MIN_POSTS = 6
export const POSTS_BUCKET = 'posts'

// Artists are not publishing on Comunidad for now. The buttons stay in the
// code; the feed they see is the obras, not posts. Flip this to bring them back.
export const COMMUNITY_POSTING = false
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

/** The tags an item shares with a taste, weighted. 0 when nothing matches. */
export function tasteScore(tags: string[], taste: Record<string, number>): number {
  if (!Array.isArray(tags) || !taste) return 0
  const seen = new Set<string>()
  let score = 0
  for (const tag of tags) {
    // Repeats count once; a tag with no weight adds nothing.
    if (typeof tag !== 'string' || seen.has(tag)) continue
    seen.add(tag)
    const weight = taste[tag]
    if (typeof weight !== 'number' || !Number.isFinite(weight)) continue
    score += weight
  }
  return score
}

/** Likes or comments clamped to a usable count: missing, negative or NaN become 0. */
function count(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

/** Milliseconds for `createdAt`; null when it doesn't parse. */
function time(value: string | undefined): number | null {
  if (typeof value !== 'string') return null
  const at = Date.parse(value)
  return Number.isNaN(at) ? null : at
}

/**
 * Orders a cached list for one visitor, in the browser.
 * - No taste: the same array, same order (copy, never mutate).
 * - `pinned` always first, keeping its relative order.
 * - Otherwise: tag match (sum of weights), then popularity, then recency.
 */
export function rankForTaste<T extends {
  tags: string[]
  pinned?: boolean
  createdAt?: string
  likes?: number
  comments?: number
}>(items: T[], taste: Record<string, number>): T[] {
  // Never mutate the caller's array or its objects: sort a copy of the entries.
  const copy = [...items]
  if (!taste || Object.keys(taste).length === 0) return copy

  let likesMax = 0
  let commentsMax = 0
  let oldest = Number.POSITIVE_INFINITY
  let newest = Number.NEGATIVE_INFINITY
  for (const item of copy) {
    likesMax = Math.max(likesMax, count(item.likes))
    commentsMax = Math.max(commentsMax, count(item.comments))
    const at = time(item.createdAt)
    if (at == null) continue
    oldest = Math.min(oldest, at)
    newest = Math.max(newest, at)
  }
  const span = newest > oldest ? newest - oldest : 0

  const scored = copy.map((item, index) => {
    const at = time(item.createdAt)
    const recency = at == null || span === 0 ? 0 : 0.2 * ((at - oldest) / span)
    return {
      item,
      index,
      pinned: item.pinned === true,
      score:
        tasteScore(item.tags, taste) +
        0.5 * (likesMax > 0 ? count(item.likes) / likesMax : 0) +
        0.3 * (commentsMax > 0 ? count(item.comments) / commentsMax : 0) +
        recency,
    }
  })

  // Pinned first, then the score; `index` keeps ties in their original order.
  scored.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.score - a.score || a.index - b.index)
  return scored.map((entry) => entry.item)
}

/** The `{ tag: weight }` shape from rows returned by community_taste(). */
export function tasteFromRows(rows: { tag: string; weight: number }[]): Record<string, number> {
  const taste: Record<string, number> = {}
  if (!Array.isArray(rows)) return taste
  for (const row of rows) {
    if (!row || typeof row.tag !== 'string') continue
    const tag = row.tag.trim()
    const weight = row.weight
    // Empty tags and weights outside (0, ∞) carry no signal.
    if (!tag || typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) continue
    if (tag === '__proto__' || tag === 'constructor' || tag === 'prototype') continue
    taste[tag] = (taste[tag] ?? 0) + weight
  }
  return taste
}
