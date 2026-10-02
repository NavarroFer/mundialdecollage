// The jury's mails, from the editable system templates jurado_invitacion and
// jurado_recordatorio. Sent as transactional mail (lib/mail, like the receipts:
// no unsubscribe footer), in Spanish — jurors have no country on record.
// Server-only (service role).
import type { SupabaseClient } from '@supabase/supabase-js'
import { isMailConfigured, sendMail } from '@/lib/mail'
import { personalizeHtml } from '@/lib/email-blocks'
import { ensureSystemTemplate, fillTextTag, renderSystemEmail, type StoredTemplate } from '@/lib/system-templates'
import { DEFAULT_LOCALE } from '@/lib/i18n/locales'
import { getJuryPool } from '@/lib/jury'
import { formatJuryDeadline, isReminderDay, jurorsToRemind, type ReminderJuror } from '@/lib/jury-deadline'
import { site } from '@/lib/site'

type Recipient = { email: string; name: string | null }

const deadlineLabel = () => formatJuryDeadline(site.jury.deadlineISO) ?? 'a confirmar'

async function send(template: StoredTemplate, to: Recipient, tags: Record<string, string>): Promise<string | null> {
  const email = renderSystemEmail(template, DEFAULT_LOCALE, {})
  let html = personalizeHtml(email.html, to.name)
  let subject = email.subject
  for (const [tag, value] of Object.entries(tags)) {
    html = fillTextTag(html, tag, value)
    subject = fillTextTag(subject, tag, value)
  }
  const result = await sendMail({ to: to.email, replyTo: site.email, subject, html })
  return result.ok ? null : result.error
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

/**
 * Invites one juror to /jurado and records invited_at. Never throws: returns
 * what went wrong, so adding the juror still counts when the mail fails.
 */
export async function sendJuryInvitation(db: SupabaseClient, juror: Recipient & { id: string }): Promise<string | null> {
  if (!isMailConfigured) return 'No hay ningún proveedor de mail configurado.'
  try {
    const template = await ensureSystemTemplate(db, 'jurado_invitacion')
    const error = await send(template, juror, { obras: String(site.jury.poolSize), fecha_limite: deadlineLabel() })
    if (error) return error
    const { error: updateError } = await db.from('jurors').update({ invited_at: new Date().toISOString() }).eq('id', juror.id)
    if (updateError) console.error('jury invitation: invited_at not saved', juror.id, updateError)
    return null
  } catch (err) {
    console.error('jury invitation failed', juror.id, err)
    return message(err)
  }
}

/**
 * The reminders due today (3 and 1 days before site.jury.deadlineISO), for
 * the cron. Each juror is claimed (reminded_on = today) before the send, so
 * an overlapping run can't remind twice; a failed send releases the claim.
 * Returns how many went out and the problems, never throws.
 */
export async function sendJuryReminders(db: SupabaseClient, today: string, { dryRun = false } = {}): Promise<{ sent: number; due: number; problems: string[] }> {
  const deadlineISO = site.jury.deadlineISO
  if (!deadlineISO || !isReminderDay(deadlineISO, today)) return { sent: 0, due: 0, problems: [] }
  try {
    const [pool, jurorsResult] = await Promise.all([
      getJuryPool(db),
      db.from('jurors').select('id, email, name, active, reminded_on').eq('active', true),
    ])
    if (jurorsResult.error) throw new Error(jurorsResult.error.message)
    const jurors = (jurorsResult.data ?? []) as ReminderJuror[]
    const scoresResult = jurors.length
      ? await db.from('jury_scores').select('juror_id, item_key').in('juror_id', jurors.map((j) => j.id))
      : { data: [], error: null }
    if (scoresResult.error) throw new Error(scoresResult.error.message)
    const targets = jurorsToRemind(jurors, scoresResult.data ?? [], pool.map((item) => item.key), today)
    if (dryRun || targets.length === 0) return { sent: 0, due: targets.length, problems: [] }
    if (!isMailConfigured) return { sent: 0, due: targets.length, problems: ['Jurado: no hay ningún proveedor de mail configurado, los recordatorios quedaron sin enviar.'] }

    const template = await ensureSystemTemplate(db, 'jurado_recordatorio')
    const fechaLimite = deadlineLabel()
    const problems: string[] = []
    let sent = 0
    for (const { juror, missing } of targets) {
      const { data: claimed } = await db.from('jurors')
        .update({ reminded_on: today })
        .eq('id', juror.id)
        .or(`reminded_on.is.null,reminded_on.lt.${today}`)
        .select('id')
      if (!claimed?.length) continue
      const error = await send(template, juror, { faltan: String(missing), fecha_limite: fechaLimite }).catch(message)
      if (error) {
        await db.from('jurors').update({ reminded_on: juror.reminded_on }).eq('id', juror.id)
        problems.push(`Jurado: no se pudo mandar el recordatorio a ${juror.email} (${error}).`)
      } else sent++
    }
    return { sent, due: targets.length, problems }
  } catch (err) {
    console.error('jury reminders failed', err)
    return { sent: 0, due: 0, problems: [`Jurado: recordatorios: ${message(err)}`] }
  }
}
