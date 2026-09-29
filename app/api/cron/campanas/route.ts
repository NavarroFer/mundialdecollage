import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createResendClient, isResendConfigured } from '@/lib/resend'
import { campaignRecipients, deliverCampaign } from '@/lib/campaign-delivery'
import { argentinaDay } from '@/lib/campaign-schedule'
import { ADMIN_EMAILS } from '@/lib/admin'
import { getSiteUrl, site } from '@/lib/site'

export const maxDuration = 300

// Vercel Cron calls this at 12:10 UTC (09:10 Argentina) with
// `Authorization: Bearer $CRON_SECRET`, and it sends every scheduled campaign
// due today or earlier (a missed day goes out on the next run). Each one is
// claimed by flipping it to 'sending' first, so an overlapping run can't send
// it twice. `?dry=1` lists what would go out without sending anything.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  const dryRun = request.nextUrl.searchParams.get('dry') === '1'
  const db = createAdminClient()
  const today = argentinaDay()

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
    return NextResponse.json({ dryRun, today, campaigns })
  }
  if ((due ?? []).length > 0 && !isResendConfigured) {
    await notifyAdmins(['Resend no está configurado: las campañas programadas quedaron sin enviar.'])
    return NextResponse.json({ error: 'Resend no está configurado' }, { status: 500 })
  }

  const report: Record<string, unknown>[] = []
  const problems: string[] = []
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
      const message = err instanceof Error ? err.message : String(err)
      console.error('scheduled campaign failed', campaign.id, message)
      report.push({ id: campaign.id, subject: campaign.subject, error: message })
      problems.push(`"${campaign.subject}": ${message}`)
    }
  }

  if (problems.length) await notifyAdmins(problems)
  return NextResponse.json({ today, campaigns: report }, { status: problems.length ? 500 : 200 })
}

async function notifyAdmins(problems: string[]) {
  if (!isResendConfigured) return
  const { error } = await createResendClient().emails.send({
    from: site.mailFrom,
    to: ADMIN_EMAILS,
    subject: 'Mundial de Collage · Campañas programadas con problemas',
    text: `${problems.join('\n\n')}\n\n${getSiteUrl()}/admin/campanas`,
  })
  if (error) console.error('scheduled campaign notify failed', error)
}
