// The daily "hoy tu obra está en el museo" mail: every morning at 09:00
// Argentina, app/api/cron/exhibition writes to the artists of the 20 obras
// hanging in the 3D gallery that day (supabase/migrations/
// 20260925120000_exhibition_days.sql). Its wording is the `museo_hoy`
// system template (lib/system-templates.ts), editable from /admin/plantillas.
import { contactLocale } from '@/lib/email-translation'
import { isValidEmail } from '@/lib/resend'
import { fillTextTag } from '@/lib/system-templates'
import type { Locale } from '@/lib/i18n/locales'

/** {{obra}} → the artwork's title, escaped. */
export function fillArtworkTitle(html: string, title: string): string {
  return fillTextTag(html, 'obra', title.trim())
}

/**
 * Why an artist can't get an automatic mail, or null if they can: only to a
 * valid address that's in `contacts` and still subscribed (so the footer's
 * unsubscribe link works and opting out is respected).
 */
export function unreachableReason(row: { email: string | null; contact_id: string | null; subscribed: boolean | null }): string | null {
  if (!row.email) return 'La obra no tiene email'
  if (!isValidEmail(row.email)) return 'Formato de email inválido'
  if (!row.contact_id) return 'El email no está en contactos'
  if (!row.subscribed) return 'Se dio de baja'
  return null
}

/** One row of exhibition_mail_queue() (see the migration). */
export type ExhibitionQueueRow = {
  day: string
  slot: number
  artwork_id: string
  artwork_title: string
  artwork_slug: string
  artist_name: string | null
  country_code: string | null
  email: string | null
  contact_id: string | null
  subscribed: boolean | null
  sent_before: boolean
}

export type ExhibitionRecipient = ExhibitionQueueRow & { email: string; contact_id: string; locale: Locale }

/**
 * Who gets today's mail. Everyone else is skipped with the reason, which ends
 * up in exhibition_days.notify_error: one mail per obra ever (a repeat day
 * after the whole pool has hung stays quiet), only to contacts still
 * subscribed, and one per person a day even with two obras on the walls.
 */
export function planExhibitionMails(rows: ExhibitionQueueRow[]): {
  send: ExhibitionRecipient[]
  skip: { row: ExhibitionQueueRow; reason: string }[]
} {
  const send: ExhibitionRecipient[] = []
  const skip: { row: ExhibitionQueueRow; reason: string }[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    const reason =
      row.sent_before ? 'Ya se le avisó por esta obra'
      : unreachableReason(row)
      ?? (seen.has(row.email!) ? 'Ya recibe hoy el aviso por otra obra' : null)
    if (reason) {
      skip.push({ row, reason })
      continue
    }
    seen.add(row.email!)
    send.push({ ...row, email: row.email!, contact_id: row.contact_id!, locale: contactLocale(row.country_code) })
  }
  return { send, skip }
}
