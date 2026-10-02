// The participation certificates, mailed to every artist from the day the
// call closes (app/admin/convocatoria), as many a day as the mail quotas
// allow — the daily cron sends the rest: one mail per artist with their obra's
// diploma (PDF) and Instagram image. The links carry a signed token
// (lib/certificate-token.ts) since many Registro artists never sign in.
// Its wording is the `certificado` system template, editable from
// /admin/plantillas. Each artist is claimed in certificate_sends before the
// send (supabase/migrations/20261002130000_certificate_sends.sql),
// so nobody gets it twice.
import type { SupabaseClient } from '@supabase/supabase-js'
import { ADMIN_EMAILS } from '@/lib/admin'
import { certificateSecret, certificateToken } from '@/lib/certificate-token'
import { personalizeHtml } from '@/lib/email-blocks'
import { contactLocale, withUnsubscribeFooter } from '@/lib/email-translation'
import { fillArtworkTitle } from '@/lib/exhibition-mail'
import { isValidEmail } from '@/lib/resend'
import { bulkCapacity, isMailConfigured, sendMails } from '@/lib/mail'
import { ensureSystemTemplate, fillTextTag, renderSystemEmail, translationsForLocales } from '@/lib/system-templates'
import type { Locale } from '@/lib/i18n/locales'
import { getSiteUrl, site } from '@/lib/site'

/** One row of certificate_recipients() (see the migration). */
export type CertificateRecipientRow = {
  profile_id: string
  artist_name: string | null
  country_code: string | null
  email: string | null
  contact_id: string | null
  subscribed: boolean | null
  artwork_slug: string
  artwork_title: string | null
}

export type CertificateRecipient = CertificateRecipientRow & { email: string; locale: Locale; retry: boolean }

export type CertificateSendStatus = 'sending' | 'sent' | 'failed'

export type CertificateOverview = {
  total: number
  sent: number
  failed: number
  /** Claimed but never marked: a send cut off midway. Not retried automatically. */
  sending: number
  /** Never sent, and can be. */
  pending: number
  unreachable: { row: CertificateRecipientRow; reason: string }[]
  /** Pending plus failed: what «Enviar certificados pendientes» sends. */
  toSend: CertificateRecipient[]
  /** Any obra to preview the certificate with. */
  sampleSlug: string | null
}

/**
 * Why an artist can't be mailed a certificate, or null if they can. The
 * certificate route needs a name and a country (lib/finalists.ts) — without
 * them the links would 404. Unsubscribed contacts still get it: it's their
 * certificate, not a newsletter.
 */
export function certificateUnreachableReason(row: CertificateRecipientRow): string | null {
  if (!row.email) return 'No tiene email'
  if (!isValidEmail(row.email)) return 'Formato de email inválido'
  if (ADMIN_EMAILS.includes(row.email)) return 'Es admin'
  if (!row.artist_name?.trim() || !row.country_code) return 'Le falta el nombre o el país'
  return null
}

export function certificateOverview(rows: CertificateRecipientRow[], sends: Map<string, CertificateSendStatus>): CertificateOverview {
  const overview: CertificateOverview = {
    total: rows.length, sent: 0, failed: 0, sending: 0, pending: 0, unreachable: [], toSend: [], sampleSlug: rows[0]?.artwork_slug ?? null,
  }
  for (const row of rows) {
    const status = sends.get(row.profile_id)
    if (status === 'sent') { overview.sent++; continue }
    if (status === 'sending') { overview.sending++; continue }
    const reason = certificateUnreachableReason(row)
    if (reason) { overview.unreachable.push({ row, reason }); continue }
    if (status === 'failed') overview.failed++
    else overview.pending++
    overview.toSend.push({ ...row, email: row.email!, locale: contactLocale(row.country_code), retry: status === 'failed' })
  }
  return overview
}

/** The mailed links: the diploma and the Instagram image, signed. */
export function certificateLinks(slug: string, secret: string) {
  const base = `${getSiteUrl()}/obras/${encodeURIComponent(slug)}/certificado`
  const t = certificateToken(slug, secret)
  return { pdf: `${base}?formato=pdf&t=${t}`, image: `${base}?formato=imagen&t=${t}` }
}

export async function loadCertificateOverview(db: SupabaseClient): Promise<CertificateOverview> {
  const [{ data: rows, error }, { data: sends, error: sendsError }] = await Promise.all([
    db.rpc('certificate_recipients'),
    db.from('certificate_sends').select('profile_id, status'),
  ])
  if (error) throw new Error(`No se pudo leer a quién mandar los certificados: ${error.message}`)
  if (sendsError) throw new Error(`No se pudo leer los envíos de certificados: ${sendsError.message}`)
  const statuses = new Map((sends ?? []).map((s: { profile_id: string; status: CertificateSendStatus }) => [s.profile_id, s.status]))
  return certificateOverview((rows ?? []) as CertificateRecipientRow[], statuses)
}

/**
 * Mails the certificate to everyone who hasn't got it yet (or whose send
 * failed), as many as the mail quotas allow today (lib/mail: Brevo first,
 * then Resend). The rest stay pending for the daily cron
 * (app/api/cron/certificados). Needs the service role. Throws when it can't
 * start at all; otherwise reports how many went out, how many wait for
 * another day, and the first error, if any.
 */
export async function sendCertificates(db: SupabaseClient): Promise<{ sent: number; failed: number; deferred: number; firstError: string | null }> {
  if (!isMailConfigured) throw new Error('No hay ningún proveedor de mail configurado')
  const secret = certificateSecret()
  if (!secret) throw new Error('Falta CERTIFICATE_SECRET (o CRON_SECRET) para firmar los links')

  const { toSend } = await loadCertificateOverview(db)
  const capacity = await bulkCapacity()
  const today = capacity === null ? toSend : toSend.slice(0, capacity)
  const deferred = toSend.length - today.length
  const recipients = await claim(db, today)
  if (recipients.length === 0) return { sent: 0, failed: 0, deferred, firstError: null }

  const template = await ensureSystemTemplate(db, 'certificado')
  const translations = await translationsForLocales(db, template, recipients.map((r) => r.locale))

  const results = await sendMails(recipients.map((r) => {
    const email = renderSystemEmail(template, r.locale, translations)
    const links = certificateLinks(r.artwork_slug, secret)
    let html = fillArtworkTitle(personalizeHtml(email.html, r.artist_name), r.artwork_title, email.locale)
    html = fillTextTag(fillTextTag(html, 'link_pdf', links.pdf), 'link_imagen', links.image)
    // The usual unsubscribe footer when the artist is a subscribed contact;
    // without a contact there's no link to offer.
    if (r.contact_id && r.subscribed) html = withUnsubscribeFooter(html, r.contact_id, email.locale)
    return { to: r.email, subject: email.subject, html }
  }), { kind: 'bulk' })

  const now = new Date().toISOString()
  const rows = recipients.map((r, i) => {
    const result = results[i]
    return result.ok
      ? { profile_id: r.profile_id, status: 'sent', error: null, resend_email_id: result.id, sent_at: now }
      : { profile_id: r.profile_id, status: 'failed', error: result.error, resend_email_id: null, sent_at: null }
  })
  const { error: markError } = await db.from('certificate_sends').upsert(rows, { onConflict: 'profile_id' })
  if (markError) console.error('certificate_sends update failed', markError)

  const failed = rows.filter((row) => row.status === 'failed')
  return { sent: rows.length - failed.length, failed: failed.length, deferred, firstError: failed[0]?.error ?? null }
}

// Only the artists this run claimed come back: new ones are inserted as
// 'sending' (a row already there is left alone), failed ones flipped from
// 'failed' to 'sending'. Two overlapping sends can't both claim anyone.
async function claim(db: SupabaseClient, recipients: CertificateRecipient[]): Promise<CertificateRecipient[]> {
  const claimed = new Set<string>()
  const fresh = recipients.filter((r) => !r.retry).map((r) => ({ profile_id: r.profile_id, status: 'sending' }))
  if (fresh.length) {
    const { data, error } = await db.from('certificate_sends')
      .upsert(fresh, { onConflict: 'profile_id', ignoreDuplicates: true })
      .select('profile_id')
    if (error) throw new Error(`No se pudo registrar el envío: ${error.message}`)
    for (const c of (data ?? []) as { profile_id: string }[]) claimed.add(c.profile_id)
  }
  // The ids go in the query string: in chunks, so a big retry stays under
  // URL length limits.
  const retries = recipients.filter((r) => r.retry).map((r) => r.profile_id)
  for (let i = 0; i < retries.length; i += 100) {
    const { data, error } = await db.from('certificate_sends')
      .update({ status: 'sending', error: null })
      .in('profile_id', retries.slice(i, i + 100)).eq('status', 'failed')
      .select('profile_id')
    if (error) throw new Error(`No se pudo registrar el reintento: ${error.message}`)
    for (const c of (data ?? []) as { profile_id: string }[]) claimed.add(c.profile_id)
  }
  return recipients.filter((r) => claimed.has(r.profile_id))
}
