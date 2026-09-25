// The daily "hoy tu obra está en el museo" mail: every morning at 09:00
// Argentina, app/api/cron/exhibition writes to the artists of the 20 obras
// hanging in the 3D gallery that day (supabase/migrations/
// 20260925120000_exhibition_days.sql). The wording lives in a regular
// template (found by EXHIBITION_TEMPLATE_KEY), so it can be edited — and
// gets translated — from /admin/plantillas like any other.
import { nextBlockId, type EmailDocument } from '@/lib/email-blocks'
import { contactLocale } from '@/lib/email-translation'
import { isValidEmail } from '@/lib/resend'
import { getSiteUrl } from '@/lib/site'
import type { Locale } from '@/lib/i18n/locales'

export const EXHIBITION_TEMPLATE_KEY = 'museo_hoy'
export const EXHIBITION_TEMPLATE_NAME = 'Aviso diario: tu obra está en el museo'
export const EXHIBITION_DEFAULT_SUBJECT = 'Hoy tu obra está en el museo del Mundial de Collage'

// First version of the template, stored the first time the cron runs; from
// then on the stored one (and any edits to it) is what goes out.
export function createExhibitionEmailDocument(siteUrl = getSiteUrl()): EmailDocument {
  return {
    blocks: [
      { id: nextBlockId(), type: 'image', url: `${siteUrl}/logo.png`, alt: 'Mundial de Collage', link: siteUrl, widthPct: 40 },
      { id: nextBlockId(), type: 'spacer', size: 'sm' },
      { id: nextBlockId(), type: 'heading', text: 'Hola {{nombre}}, hoy tu obra está en el museo', align: 'left', size: 'md' },
      {
        id: nextBlockId(),
        type: 'text',
        text: 'Todos los días colgamos 20 obras del Mundial Internacional de Collage en nuestra Galería 3D, y hoy «{{obra}}» es una de ellas.',
        align: 'left',
      },
      {
        id: nextBlockId(),
        type: 'text',
        text: 'Entrá desde el navegador, recorré las salas y buscala en la pared. Sacale una captura y compartila: mañana a las 9 la muestra cambia.',
        align: 'left',
      },
      { id: nextBlockId(), type: 'button', text: 'Visitar el museo', url: `${siteUrl}/galeria-3d`, align: 'left', color: 'red' },
      { id: nextBlockId(), type: 'divider' },
      { id: nextBlockId(), type: 'text', text: 'Mundial Internacional de Collage', align: 'center' },
    ],
  }
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const OBRA_TOKEN = /\{\{\s*obra\s*\}\}/gi

// {{obra}} → the artwork's title. A replacer function for the same reason as
// personalizeHtml: a title with "$&" in it must come out literal.
export function fillArtworkTitle(html: string, title: string): string {
  const escaped = escapeHtml(title.trim())
  return html.replace(OBRA_TOKEN, () => escaped)
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
      : !row.email ? 'La obra no tiene email'
      : !isValidEmail(row.email) ? 'Formato de email inválido'
      : !row.contact_id ? 'El email no está en contactos'
      : !row.subscribed ? 'Se dio de baja'
      : seen.has(row.email) ? 'Ya recibe hoy el aviso por otra obra'
      : null
    if (reason) {
      skip.push({ row, reason })
      continue
    }
    seen.add(row.email!)
    send.push({ ...row, email: row.email!, contact_id: row.contact_id!, locale: contactLocale(row.country_code) })
  }
  return { send, skip }
}
