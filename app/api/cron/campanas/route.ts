import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isMailConfigured } from '@/lib/mail'
import { cronRoute, errorMessage, mailAdmins } from '@/lib/cron'
import { campaignRecipients, deliverCampaign } from '@/lib/campaign-delivery'
import { argentinaDay } from '@/lib/campaign-schedule'
import { getSiteUrl } from '@/lib/site'
import { ensureCountdownCampaigns } from '@/lib/countdown-campaigns'
import { sendJuryReminders } from '@/lib/jury-mail'

export const maxDuration = 300

// Vercel Cron calls this at 12:10 UTC (09:10 Argentina) with
// `Authorization: Bearer $CRON_SECRET`, and it sends every scheduled campaign
// due today or earlier (a missed day goes out on the next run). Each one is
// claimed by flipping it to 'sending' first, so an overlapping run can't send
// it twice. `?dry=1` lists what would go out without sending anything.
export const GET = cronRoute(async ({ dryRun }) => {
  const db = createAdminClient()
  const today = argentinaDay()

  // The countdown to the deadline schedules itself (lib/countdown-campaigns.ts),
  // before looking for what's due, so one due today also goes out today.
  let countdownProblem: string | null = null
  let countdownCreated: string[] = []
  if (!dryRun) {
    try {
      countdownCreated = await ensureCountdownCampaigns(db, today)
    } catch (err) {
      countdownProblem = `Cuenta regresiva: ${errorMessage(err)}`
      console.error('countdown campaigns failed', countdownProblem)
    }
  }

  // Reminders to the jurors with obras left to score, 3 days and 1 day before
  // the voting deadline (lib/jury-mail.ts). Nothing without site.jury.deadlineISO.
  const jury = await sendJuryReminders(db, today, { dryRun })

  const { data: due, error: dueError } = await db
    .from('campaigns')
    .select('id, subject, audience, scheduled_for')
    .eq('status', 'scheduled')
    .lte('scheduled_for', today)
    .order('scheduled_for')
  if (dueError) return NextResponse.json({ error: dueError.message }, { status: 500 })

  if (dryRun) {
    const campaigns = []
    for (const campaign of due ?? []) {
      const { recipients, error } = await campaignRecipients(db, campaign.audience)
      campaigns.push({ ...campaign, recipients: error ? { error } : recipients.length })
    }
    return NextResponse.json({ dryRun, today, campaigns, juryReminders: jury.due })
  }
  if ((due ?? []).length > 0 && !isMailConfigured) {
    return NextResponse.json({ error: 'No hay ningún proveedor de mail configurado' }, { status: 500 })
  }

  const report: Record<string, unknown>[] = []
  const problems: string[] = [...(countdownProblem ? [countdownProblem] : []), ...jury.problems]
  for (const { id } of due ?? []) {
    const { data: campaign } = await db
      .from('campaigns')
      .update({ status: 'sending' })
      .eq('id', id)
      .eq('status', 'scheduled')
      .select('id, subject, body_html, body_json, translations, audience')
      .maybeSingle()
    if (!campaign) continue

    try {
      const { recipients, error } = await campaignRecipients(db, campaign.audience)
      if (error) {
        // Back to 'scheduled' so the next run tries again.
        await db.from('campaigns').update({ status: 'scheduled' }).eq('id', campaign.id)
        throw new Error(`no se pudo armar la lista de destinatarios (se reintenta mañana): ${error}`)
      }
      const result = await deliverCampaign(db, campaign, recipients)
      report.push({ id: campaign.id, subject: campaign.subject, recipients: recipients.length, ...result })
      if (recipients.length === 0) problems.push(`"${campaign.subject}": no había contactos suscriptos en ese público.`)
      else if (result.failedCount > 0) {
        problems.push(`"${campaign.subject}": ${result.failedCount} de ${recipients.length} fallaron (${result.firstError}).`)
      }
    } catch (err) {
      const message = errorMessage(err)
      console.error('scheduled campaign failed', campaign.id, message)
      report.push({ id: campaign.id, subject: campaign.subject, error: message })
      problems.push(`"${campaign.subject}": ${message}`)
    }
  }

  if (problems.length) {
    await mailAdmins('Mundial de Collage · Campañas programadas con problemas', `${problems.join('\n\n')}\n\n${getSiteUrl()}/admin/campanas`)
  }
  return NextResponse.json({ today, countdownCreated, campaigns: report, juryReminders: { sent: jury.sent, due: jury.due } }, { status: problems.length ? 500 : 200 })
})
