// The participation certificates, mailed to every artist the day the call
// closes (app/admin/convocatoria): one mail per artist with their obra's
// diploma (PDF) and Instagram image. The links carry a signed token
// (lib/certificate-token.ts) since many Registro artists never sign in.
// Its wording is the `certificado` system template, editable from
// /admin/plantillas. Each artist is claimed in certificate_sends before the
// Resend call (supabase/migrations/20261002130000_certificate_sends.sql),
// so nobody gets it twice.
import type { SupabaseClient } from '@supabase/supabase-js'
import { ADMIN_EMAILS } from '@/lib/admin'
import { certificateSecret, certificateToken } from '@/lib/certificate-token'
import { personalizeHtml } from '@/lib/email-blocks'
import { contactLocale, withUnsubscribeFooter } from '@/lib/email-translation'
import { fillArtworkTitle } from '@/lib/exhibition-mail'
import { createResendClient, isResendConfigured, isValidEmail, RESEND_BATCH_SIZE } from '@/lib/resend'
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

// Resend allows a couple of API calls per second by default; a short pause
// between batches keeps a big send from tripping it.
const BATCH_PAUSE_MS = 600

/**
 * Mails the certificate to everyone who hasn't got it yet (or whose send
 * failed). Needs the service role. Throws when it can't start at all;
 * otherwise reports how many went out and the first error, if any.
 */
export async function sendCertificates(db: SupabaseClient): Promise<{ sent: number; failed: number; firstError: string | null }> {
  if (!isResendConfigured) throw new Error('Resend no está configurado')
  const secret = certificateSecret()
  if (!secret) throw new Error('Falta CERTIFICATE_SECRET (o CRON_SECRET) para firmar los links')

  const { toSend } = await loadCertificateOverview(db)
  const recipients = await claim(db, toSend)
  if (recipients.length === 0) return { sent: 0, failed: 0, firstError: null }

  const template = await ensureSystemTemplate(db, 'certificado')
  const translations = await translationsForLocales(db, template, recipients.map((r) => r.locale))

  let sent = 0
  let failed = 0
  let firstError: string | null = null
  for (let i = 0; i < recipients.length; i += RESEND_BATCH_SIZE) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, BATCH_PAUSE_MS))
    const batch = recipients.slice(i, i + RESEND_BATCH_SIZE)
    // Resend's SDK resolves to { data, error } instead of throwing; guard
    // anyway so a network error marks the batch failed instead of leaving
    // it stuck in 'sending'.
    const { data: result, error } = await createResendClient().batch.send(batch.map((r) => {
      const email = renderSystemEmail(template, r.locale, translations)
      const links = certificateLinks(r.artwork_slug, secret)
      let html = fillArtworkTitle(personalizeHtml(email.html, r.artist_name), r.artwork_title, email.locale)
      html = fillTextTag(fillTextTag(html, 'link_pdf', links.pdf), 'link_imagen', links.image)
      // The usual unsubscribe footer when the artist is a subscribed contact;
      // without a contact there's no link to offer.
      if (r.contact_id && r.subscribed) html = withUnsubscribeFooter(html, r.contact_id, email.locale)
      return { from: site.mailFrom, to: r.email, subject: email.subject, html }
    })).catch((err: unknown) => ({ data: null, error: { message: err instanceof Error ? err.message : String(err) } }))

    const now = new Date().toISOString()
    const rows = batch.map((r, j) => error || !result
      ? { profile_id: r.profile_id, status: 'failed', error: error?.message ?? 'Error desconocido', resend_email_id: null, sent_at: null }
      : { profile_id: r.profile_id, status: 'sent', error: null, resend_email_id: result.data[j]?.id ?? null, sent_at: now })
    const { error: markError } = await db.from('certificate_sends').upsert(rows, { onConflict: 'profile_id' })
    if (markError) console.error('certificate_sends update failed', markError)

    if (error || !result) {
      failed += batch.length
      firstError ??= error?.message ?? 'Error desconocido'
    } else {
      sent += batch.length
    }
  }
  return { sent, failed, firstError }
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
