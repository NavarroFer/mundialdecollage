import { NextRequest, NextResponse } from 'next/server'
import { sendSupporterWelcomes } from '@/lib/supporter-welcome'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { isMailConfigured, sendMail, sendMails } from '@/lib/mail'
import { personalizeHtml } from '@/lib/email-blocks'
import { withUnsubscribeFooter } from '@/lib/email-translation'
import {
  fillArtworkTitle,
  planExhibitionMails,
  type ExhibitionQueueRow,
  type ExhibitionRecipient,
} from '@/lib/exhibition-mail'
import { digestWindow, fillDigestTags, planArtistDigests, type DigestRow } from '@/lib/artist-digest'
import { ensureSystemTemplate, fillTextTag, renderSystemEmail, translationsForLocales } from '@/lib/system-templates'
import { galleryArtworkPath } from '@/lib/gallery-return'
import { ADMIN_EMAILS } from '@/lib/admin'
import { getSiteUrl, site } from '@/lib/site'

export const maxDuration = 300

// Vercel Cron calls this at 12:05 UTC (09:05 Argentina, right after the
// exhibition rotates) with `Authorization: Bearer $CRON_SECRET`. Three
// independent jobs, so one failing doesn't stop the others:
//   1. "hoy tu obra está en el museo" to today's 20 artists,
//   2. "así le fue a tu obra" to artists with likes/comments yesterday,
//   3. a reminder to the admins when comments are waiting for moderation.
// Safe to run again: every mail is claimed in the database before it's
// sent. `?dry=1` shows who would get what without sending anything.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  const dryRun = request.nextUrl.searchParams.get('dry') === '1'
  const db = createAdminClient()
  const report: Record<string, unknown> = { dryRun }
  const problems: string[] = []

  const jobs: [string, string, () => Promise<{ result: unknown; problem?: string }>][] = [
    ['museum', 'Aviso "hoy tu obra está en el museo"', () => sendMuseumNotices(db, dryRun)],
    ['digest', 'Aviso "así le fue a tu obra"', () => sendArtistDigests(db, dryRun)],
    ['pendingComments', 'Recordatorio de comentarios', () => remindPendingComments(db, dryRun)],
    ['supporters', 'Bienvenida a hinchas', () => sendSupporterWelcomes(db, dryRun)],
  ]
  for (const [key, label, job] of jobs) {
    try {
      const { result, problem } = await job()
      report[key] = result
      if (problem) problems.push(`${label}: ${problem}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`${key} failed`, message)
      report[key] = { error: message }
      problems.push(`${label} no salió: ${message}`)
    }
  }

  if (problems.length && !dryRun) await notifyAdmins('Mundial de Collage · Avisos diarios con problemas', problems.join('\n\n'))
  return NextResponse.json(report, { status: problems.length ? 500 : 200 })
}

async function sendMuseumNotices(db: SupabaseClient, dryRun: boolean) {
  const { error: lineupError } = await db.rpc('ensure_exhibition_today')
  if (lineupError) throw new Error(`No se pudo armar la muestra de hoy: ${lineupError.message}`)

  const { data: queue, error: queueError } = await db.rpc('exhibition_mail_queue')
  if (queueError) throw new Error(`No se pudo leer a quién avisar: ${queueError.message}`)

  const { send, skip } = planExhibitionMails((queue ?? []) as ExhibitionQueueRow[])
  if (dryRun) {
    return {
      result: {
        send: send.map((r) => ({ email: r.email, name: r.artist_name, obra: r.artwork_title, locale: r.locale })),
        skip: skip.map(({ row, reason }) => ({ email: row.email, obra: row.artwork_title, reason })),
      },
    }
  }
  if (!isMailConfigured) throw new Error('No hay ningún proveedor de mail configurado')

  const now = new Date().toISOString()
  for (const { row, reason } of skip) {
    await db.from('exhibition_days')
      .update({ notify_status: 'skipped', notify_error: reason, notified_at: now })
      .eq('day', row.day).eq('slot', row.slot).is('notify_status', null)
  }

  const recipients = await claimExhibitionRows(db, send)
  if (recipients.length === 0) return { result: { sent: 0, failed: 0, skipped: skip.length } }

  const template = await ensureSystemTemplate(db, 'museo_hoy')
  const translations = await translationsForLocales(db, template, recipients.map((r) => r.locale))

  const results = await sendMails(recipients.map((r) => {
    const email = renderSystemEmail(template, r.locale, translations)
    const html = fillTextTag(
      fillArtworkTitle(personalizeHtml(email.html, r.artist_name), r.artwork_title, email.locale),
      'link_obra',
      `${getSiteUrl()}${galleryArtworkPath(r.artwork_slug)}`,
    )
    return { to: r.email, subject: email.subject, html: withUnsubscribeFooter(html, r.contact_id, email.locale) }
  }), { kind: 'bulk' })

  for (const [i, r] of recipients.entries()) {
    const result = results[i]
    const update = result.ok
      ? { notify_status: 'sent', notify_error: null, resend_email_id: result.id }
      : { notify_status: 'failed', notify_error: result.error }
    await db.from('exhibition_days')
      .update({ ...update, notified_at: new Date().toISOString() })
      .eq('day', r.day).eq('slot', r.slot)
  }
  const failed = results.filter((r) => !r.ok)
  return {
    result: { sent: results.length - failed.length, failed: failed.length, skipped: skip.length },
    problem: failed.length ? `falló para ${failed.length} artistas: ${failed[0].ok ? '' : failed[0].error}` : undefined,
  }
}

// Flips each row to 'sending' only if nobody else did first, so an
// overlapping run can't mail the same artist twice.
async function claimExhibitionRows(db: SupabaseClient, recipients: ExhibitionRecipient[]) {
  const claimed: ExhibitionRecipient[] = []
  for (const r of recipients) {
    const { data } = await db.from('exhibition_days')
      .update({ notify_status: 'sending' })
      .eq('day', r.day).eq('slot', r.slot).is('notify_status', null)
      .select('slot')
    if (data?.length) claimed.push(r)
  }
  return claimed
}

async function sendArtistDigests(db: SupabaseClient, dryRun: boolean) {
  const { start, end, day } = digestWindow()
  const { data, error: activityError } = await db.rpc('artist_activity_digest', {
    window_start: start.toISOString(),
    window_end: end.toISOString(),
  })
  if (activityError) throw new Error(`No se pudo leer la actividad: ${activityError.message}`)

  // bigint columns can come back as strings; comments as JSON.
  const rows = ((data ?? []) as DigestRow[]).map((row) => ({
    ...row,
    likes_window: Number(row.likes_window),
    likes_total: Number(row.likes_total),
    comments: Array.isArray(row.comments) ? row.comments : [],
  }))
  const { send, skip } = planArtistDigests(rows)
  if (dryRun) {
    return {
      result: {
        day,
        send: send.map((r) => ({ email: r.email, obra: r.artwork_title, likes: r.likes_window, comments: r.comments.length, locale: r.locale })),
        skip: skip.map(({ row, reason }) => ({ email: row.email, obra: row.artwork_title, reason })),
      },
    }
  }
  if (!isMailConfigured) throw new Error('No hay ningún proveedor de mail configurado')

  if (skip.length) {
    await db.from('artist_digests').upsert(
      skip.map(({ row, reason }) => ({ profile_id: row.profile_id, day, status: 'skipped', error: reason })),
      { onConflict: 'profile_id,day', ignoreDuplicates: true },
    )
  }
  // Claim: only rows this run inserted come back, so a second run sends nothing twice.
  const { data: claimed, error: claimError } = send.length
    ? await db.from('artist_digests')
      .upsert(send.map((r) => ({ profile_id: r.profile_id, day, status: 'sending' })), { onConflict: 'profile_id,day', ignoreDuplicates: true })
      .select('profile_id')
    : { data: [], error: null }
  if (claimError) throw new Error(`No se pudo registrar el envío: ${claimError.message}`)
  const claimedIds = new Set((claimed ?? []).map((c: { profile_id: string }) => c.profile_id))
  const recipients = send.filter((r) => claimedIds.has(r.profile_id))
  if (recipients.length === 0) return { result: { day, sent: 0, failed: 0, skipped: skip.length } }

  const template = await ensureSystemTemplate(db, 'novedades_obra')
  const translations = await translationsForLocales(db, template, recipients.map((r) => r.locale))

  const results = await sendMails(recipients.map((r) => {
    const email = renderSystemEmail(template, r.locale, translations, { dropBlocksWith: r.comments.length ? [] : ['comentarios'] })
    const html = fillDigestTags(fillArtworkTitle(personalizeHtml(email.html, r.artist_name), r.artwork_title, email.locale), r)
    return { to: r.email, subject: email.subject, html: withUnsubscribeFooter(html, r.contact_id, email.locale) }
  }), { kind: 'bulk' })

  let sent = 0
  let failed = 0
  let firstError: string | null = null
  for (const [j, r] of recipients.entries()) {
    const result = results[j]
    const update = result.ok
      ? { status: 'sent', error: null, resend_email_id: result.id }
      : { status: 'failed', error: result.error }
    await db.from('artist_digests').update(update).eq('profile_id', r.profile_id).eq('day', day)
    if (result.ok) sent += 1
    else { failed += 1; firstError ??= result.error }
  }
  return {
    result: { day, sent, failed, skipped: skip.length },
    problem: failed ? `falló para ${failed} artistas: ${firstError}` : undefined,
  }
}

// Comments sit unpublished until an admin approves them; a daily nudge keeps
// visitors from waiting days to see theirs.
async function remindPendingComments(db: SupabaseClient, dryRun: boolean) {
  const { count, error } = await db.from('artwork_comments').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  if (error) throw new Error(error.message)
  const pending = count ?? 0
  if (pending > 0 && !dryRun) {
    await notifyAdmins(
      `Mundial de Collage · ${pending} ${pending === 1 ? 'comentario' : 'comentarios'} para moderar`,
      `Hay ${pending} ${pending === 1 ? 'comentario esperando' : 'comentarios esperando'} aprobación en la Galería 3D. Quien lo escribió lo ve como pendiente hasta que lo aprobás.\n\n${getSiteUrl()}/admin/comentarios`,
    )
  }
  return { result: { pending } }
}

async function notifyAdmins(subject: string, text: string) {
  if (!isMailConfigured) return
  const result = await sendMail({ to: ADMIN_EMAILS, subject, text })
  if (!result.ok) console.error('exhibition notify failed', result.error)
}
