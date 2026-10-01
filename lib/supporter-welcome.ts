// «Gracias por el aguante»: one welcome mail to each hincha — someone who
// signed in to like or comment an obra in the Galería 3D without being an
// artist (mostly the artists' friends and family). The 09:05 cron
// (app/api/cron/exhibition) sends it once, the day after their first like or
// comment: thanks for backing the artist, the obra to share, the finalists
// and the magazine, and — while the call is open — a soft «¿vos también
// hacés collage?». Wording: the bienvenida_hincha system template.
import type { SupabaseClient } from '@supabase/supabase-js'
import { createResendClient, isResendConfigured, isValidEmail } from '@/lib/resend'
import { ADMIN_EMAILS } from '@/lib/admin'
import { personalizeHtml } from '@/lib/email-blocks'
import { contactLocale, withUnsubscribeFooter } from '@/lib/email-translation'
import { fillArtworkTitle } from '@/lib/exhibition-mail'
import { ensureSystemTemplate, fillTextTag, renderSystemEmail, translationsForLocales } from '@/lib/system-templates'
import { getCallState } from '@/lib/call-state'
import { formatDayMonth } from '@/lib/i18n/format'
import type { Locale } from '@/lib/i18n/locales'
import { getSiteUrl, site } from '@/lib/site'

const HOUR_MS = 60 * 60 * 1000
// Their first like or comment happened at least this long ago («the day
// after»), and not longer than LOOKBACK — the first run greets only recent
// hinchas, never someone who liked weeks ago.
const MIN_AGE_MS = 12 * HOUR_MS
const LOOKBACK_MS = 7 * 24 * HOUR_MS
const BATCH = 100

export type SupporterRow = {
  email: string
  contact_id: string
  supporter_name: string | null
  artwork_slug: string
  artwork_title: string | null
  artist_name: string | null
  artist_country: string | null
  first_at: string
}

export type SupporterRecipient = SupporterRow & { locale: Locale }

export function welcomeWindow(now = new Date()) {
  return { since: new Date(now.getTime() - LOOKBACK_MS), until: new Date(now.getTime() - MIN_AGE_MS) }
}

/**
 * Who gets the welcome and who's skipped (and why). The hincha's language
 * is a guess from the artist they backed: friends and family mostly share it.
 */
export function planSupporterWelcomes(rows: SupporterRow[], adminEmails: readonly string[] = ADMIN_EMAILS) {
  const admins = new Set(adminEmails.map((e) => e.toLowerCase()))
  const send: SupporterRecipient[] = []
  const skip: { row: SupporterRow; reason: string }[] = []
  for (const row of rows) {
    if (admins.has(row.email)) skip.push({ row, reason: 'admin' })
    else if (!isValidEmail(row.email)) skip.push({ row, reason: 'email inválido' })
    else if (!row.artist_name?.trim()) skip.push({ row, reason: 'obra sin artista' })
    else send.push({ ...row, locale: contactLocale(row.artist_country) })
  }
  return { send, skip }
}

export async function sendSupporterWelcomes(db: SupabaseClient, dryRun: boolean): Promise<{ result: unknown; problem?: string }> {
  const { since, until } = welcomeWindow()
  const { data, error } = await db.rpc('supporter_welcome_queue', { since: since.toISOString(), until: until.toISOString() })
  if (error) throw new Error(`No se pudo leer a quién dar la bienvenida: ${error.message}`)
  const { send, skip } = planSupporterWelcomes((data ?? []) as SupporterRow[])
  if (dryRun) {
    return { result: { send: send.map((r) => ({ email: r.email, artista: r.artist_name, locale: r.locale })), skip: skip.map(({ row, reason }) => ({ email: row.email, reason })) } }
  }
  if (send.length === 0 && skip.length === 0) return { result: { sent: 0, failed: 0, skipped: 0 } }
  if (!isResendConfigured) throw new Error('Resend no está configurado')

  if (skip.length) {
    await db.from('supporter_welcomes').upsert(
      skip.map(({ row, reason }) => ({ email: row.email, status: 'skipped', error: reason })),
      { onConflict: 'email', ignoreDuplicates: true },
    )
  }
  // Claim: only rows this run inserted come back, so an overlapping run
  // can't welcome anyone twice.
  const { data: claimed, error: claimError } = send.length
    ? await db.from('supporter_welcomes')
      .upsert(send.map((r) => ({ email: r.email, status: 'sending' })), { onConflict: 'email', ignoreDuplicates: true })
      .select('email')
    : { data: [], error: null }
  if (claimError) throw new Error(`No se pudo registrar el envío: ${claimError.message}`)
  const claimedEmails = new Set((claimed ?? []).map((c: { email: string }) => c.email))
  const recipients = send.filter((r) => claimedEmails.has(r.email))
  if (recipients.length === 0) return { result: { sent: 0, failed: 0, skipped: skip.length } }

  const [template, { open }] = await Promise.all([ensureSystemTemplate(db, 'bienvenida_hincha'), getCallState()])
  const translations = await translationsForLocales(db, template, recipients.map((r) => r.locale))

  let sent = 0
  let failed = 0
  let firstError: string | null = null
  for (let i = 0; i < recipients.length; i += BATCH) {
    const batch = recipients.slice(i, i + BATCH)
    const { data: result, error: sendError } = await createResendClient().batch.send(batch.map((r) => {
      // The «¿vos también hacés collage?» block only while the call is open.
      const email = renderSystemEmail(template, r.locale, translations, { dropBlocksWith: open ? [] : ['convocatoria'] })
      const fill = (source: string) => {
        let out = fillTextTag(source, 'artista', r.artist_name ?? '')
        out = fillTextTag(out, 'link_obra', `${getSiteUrl()}/obras/${r.artwork_slug}`)
        return fillTextTag(out, 'convocatoria', formatDayMonth(email.locale, site.deadlineISO))
      }
      const html = fill(fillArtworkTitle(personalizeHtml(email.html, r.supporter_name), r.artwork_title, email.locale))
      // The subject is plain text: filled as is, not HTML-escaped.
      const subject = email.subject.replace(/\{\{\s*artista\s*\}\}/gi, () => r.artist_name ?? '')
      return { from: site.mailFrom, to: r.email, subject, html: withUnsubscribeFooter(html, r.contact_id, email.locale) }
    }))
    for (const [j, r] of batch.entries()) {
      const update = sendError || !result
        ? { status: 'failed', error: sendError?.message ?? 'Error desconocido' }
        : { status: 'sent', error: null, resend_email_id: result.data[j]?.id ?? null, sent_at: new Date().toISOString() }
      await db.from('supporter_welcomes').update(update).eq('email', r.email)
    }
    if (sendError || !result) {
      failed += batch.length
      firstError ??= sendError?.message ?? 'Error desconocido'
    } else {
      sent += batch.length
    }
  }
  return {
    result: { sent, failed, skipped: skip.length },
    problem: failed ? `falló para ${failed} hinchas: ${firstError}` : undefined,
  }
}
