// "Así le fue a tu obra": each morning the 09:05 cron (app/api/cron/exhibition)
// writes to every artist whose obra got likes, or had comments approved,
// during the exhibition day that just ended — the return leg of "hoy tu obra
// está en el museo". Wording: the `novedades_obra` system template
// (lib/system-templates.ts).
import { contactLocale } from '@/lib/email-translation'
import { unreachableReason } from '@/lib/exhibition-mail'
import { escapeHtml, fillTag, fillTextTag } from '@/lib/system-templates'
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locales'

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

// One line for an artist who has not posted their obra on Comunidad yet.
// Stage 2 adds «tu publicación sumó…»; this is only the invitation (§4.10).
const COMMUNITY_INVITE: Record<Locale, string> = {
  es: 'Tu obra todavía no está en Comunidad. Publicala en un toque:',
  en: 'Your artwork is not on Comunidad yet. Post it in one tap:',
  pt: 'Sua obra ainda não está na Comunidad. Publique em um toque:',
  it: 'La tua opera non è ancora su Comunidad. Pubblicala in un tocco:',
  fr: 'Ton œuvre n’est pas encore sur Comunidad. Publie-la en un geste :',
  de: 'Dein Werk ist noch nicht in Comunidad. Veröffentliche es mit einem Tipp:',
  pl: 'Twojej pracy jeszcze nie ma w Comunidad. Opublikuj ją jednym ruchem:',
  ru: 'Твоей работы ещё нет в Comunidad. Опубликуй её в одно касание:',
  id: 'Karyamu belum ada di Comunidad. Bagikan dengan sekali ketuk:',
}

const ACTIVITY_BOTH: Record<Locale, string> = {
  es: 'Tu publicación sumó {likes} me gusta y {comments} comentarios.',
  en: 'Your post picked up {likes} likes and {comments} comments.',
  pt: 'Sua publicação somou {likes} curtidas e {comments} comentários.',
  it: 'La tua pubblicazione ha raccolto {likes} mi piace e {comments} commenti.',
  fr: 'Ta publication a reçu {likes} j’aime et {comments} commentaires.',
  de: 'Dein Beitrag hat {likes} Gefällt mir und {comments} Kommentare bekommen.',
  pl: 'Twoja publikacja zyskała {likes} polubień i {comments} komentarzy.',
  ru: 'Твоя публикация набрала {likes} отметок «Нравится» и {comments} комментариев.',
  id: 'Postinganmu mendapat {likes} suka dan {comments} komentar.',
}
const ACTIVITY_LIKES: Record<Locale, string> = {
  es: 'Tu publicación sumó {likes} me gusta.',
  en: 'Your post picked up {likes} likes.',
  pt: 'Sua publicação somou {likes} curtidas.',
  it: 'La tua pubblicazione ha raccolto {likes} mi piace.',
  fr: 'Ta publication a reçu {likes} j’aime.',
  de: 'Dein Beitrag hat {likes} Gefällt mir bekommen.',
  pl: 'Twoja publikacja zyskała {likes} polubień.',
  ru: 'Твоя публикация набрала {likes} отметок «Нравится».',
  id: 'Postinganmu mendapat {likes} suka.',
}
const ACTIVITY_COMMENTS: Record<Locale, string> = {
  es: 'Tu publicación sumó {comments} comentarios.',
  en: 'Your post picked up {comments} comments.',
  pt: 'Sua publicação somou {comments} comentários.',
  it: 'La tua pubblicazione ha raccolto {comments} commenti.',
  fr: 'Ta publication a reçu {comments} commentaires.',
  de: 'Dein Beitrag hat {comments} Kommentare bekommen.',
  pl: 'Twoja publikacja zyskała {comments} komentarzy.',
  ru: 'Твоя публикация набрала {comments} комментариев.',
  id: 'Postinganmu mendapat {comments} komentar.',
}

export function communityActivityLine(locale: Locale, likes: number, comments: number): string | null {
  const language = locale in ACTIVITY_BOTH ? locale : DEFAULT_LOCALE
  const template = likes > 0 && comments > 0 ? ACTIVITY_BOTH[language] : likes > 0 ? ACTIVITY_LIKES[language] : comments > 0 ? ACTIVITY_COMMENTS[language] : null
  if (!template) return null
  return `<p>${escapeHtml(template.replaceAll('{likes}', String(likes)).replaceAll('{comments}', String(comments)))}</p>`
}

export function communityDigestLine(locale: Locale, url: string): string {
  const text = COMMUNITY_INVITE[locale] ?? COMMUNITY_INVITE[DEFAULT_LOCALE]
  return `<p>${escapeHtml(text)} <a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`
}

/** Fills the digest's own tags ({{obra}} and {{nombre}} are filled by the caller's shared path). */
export function fillDigestTags(html: string, row: DigestRow): string {
  let out = fillTextTag(html, 'likes_total', String(row.likes_total))
  out = fillTextTag(out, 'likes', String(row.likes_window))
  return fillTag(out, 'comentarios', commentsHtml(row.comments))
}
