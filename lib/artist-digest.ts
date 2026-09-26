// "Así le fue a tu obra": each morning the 09:05 cron (app/api/cron/exhibition)
// writes to every artist whose obra got likes, or had comments approved,
// during the exhibition day that just ended — the return leg of "hoy tu obra
// está en el museo". Wording: the `novedades_obra` system template
// (lib/system-templates.ts).
import { contactLocale } from '@/lib/email-translation'
import { unreachableReason } from '@/lib/exhibition-mail'
import { escapeHtml, fillTag, fillTextTag } from '@/lib/system-templates'
import type { Locale } from '@/lib/i18n/locales'

const DAY_MS = 24 * 60 * 60 * 1000
// The exhibition day turns at 09:00 Argentina = 12:00 UTC (see
// lib/gallery-artworks.ts and public.exhibition_day()).
const ROTATION_HOUR_UTC = 12

/** The exhibition day that ended most recently: [start, end) and its date. */
export function digestWindow(now = new Date()): { start: Date; end: Date; day: string } {
  const end = new Date(now)
  end.setUTCHours(ROTATION_HOUR_UTC, 0, 0, 0)
  if (end > now) end.setTime(end.getTime() - DAY_MS)
  const start = new Date(end.getTime() - DAY_MS)
  return { start, end, day: start.toISOString().slice(0, 10) }
}

export type DigestComment = { author: string; body: string }

/** One row of artist_activity_digest() (see the migration). */
export type DigestRow = {
  profile_id: string
  artist_name: string | null
  country_code: string | null
  email: string | null
  contact_id: string | null
  subscribed: boolean | null
  artwork_title: string | null
  artwork_slug: string
  likes_window: number
  likes_total: number
  comments: DigestComment[]
}

export type DigestRecipient = DigestRow & { email: string; contact_id: string; locale: Locale }

// One mail per artist (their selected obra); same reachability rules as the
// museum mail.
export function planArtistDigests(rows: DigestRow[]): {
  send: DigestRecipient[]
  skip: { row: DigestRow; reason: string }[]
} {
  const send: DigestRecipient[] = []
  const skip: { row: DigestRow; reason: string }[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    if (seen.has(row.profile_id)) continue
    seen.add(row.profile_id)
    const reason = unreachableReason(row)
    if (reason) skip.push({ row, reason })
    else send.push({ ...row, email: row.email!, contact_id: row.contact_id!, locale: contactLocale(row.country_code) })
  }
  return { send, skip }
}

/** The approved comments as mail HTML: «text» — author, one per line. */
export function commentsHtml(comments: DigestComment[]): string {
  return comments
    .map((comment) => `«${escapeHtml(comment.body)}» — <strong>${escapeHtml(comment.author)}</strong>`)
    .join('<br /><br />')
}

/** Fills the digest's own tags ({{obra}} and {{nombre}} are filled by the caller's shared path). */
export function fillDigestTags(html: string, row: DigestRow): string {
  let out = fillTextTag(html, 'likes_total', String(row.likes_total))
  out = fillTextTag(out, 'likes', String(row.likes_window))
  return fillTag(out, 'comentarios', commentsHtml(row.comments))
}
