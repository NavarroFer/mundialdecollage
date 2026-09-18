'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createResendClient, isResendConfigured, RESEND_BATCH_SIZE, getMailFromDomain } from '@/lib/resend'
import { site, getSiteUrl } from '@/lib/site'

function withUnsubscribeFooter(bodyHtml: string, contactId: string) {
  const unsubscribeUrl = `${getSiteUrl()}/api/unsubscribe?id=${contactId}`
  return `${bodyHtml}<hr style="margin-top:32px;border:none;border-top:1px solid #ddd" /><p style="margin-top:16px;font-size:12px;color:#888">¿No querés más estos mails? <a href="${unsubscribeUrl}">Darte de baja</a>.</p>`
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

export async function sendCampaign(formData: FormData) {
  const subject = String(formData.get('subject') ?? '').trim()
  const bodyHtml = String(formData.get('body_html') ?? '').trim()
  const templateId = String(formData.get('template_id') ?? '') || null

  if (!subject || !bodyHtml) {
    redirect('/admin/campanas/nueva?error=missing_fields')
  }
  if (!isResendConfigured) {
    redirect('/admin/campanas/nueva?error=resend_not_configured')
  }

  const supabase = await createClient()

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email')
    .eq('subscribed', true)

  const recipients = contacts ?? []
  if (recipients.length === 0) {
    redirect('/admin/campanas/nueva?error=no_recipients')
  }

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      template_id: templateId,
      subject,
      body_html: bodyHtml,
      status: 'sending',
      recipient_count: recipients.length,
    })
    .select('id')
    .single()

  if (campaignError || !campaign) {
    redirect(`/admin/campanas/nueva?error=${encodeURIComponent(campaignError?.message ?? 'create_failed')}`)
  }

  const resend = createResendClient()
  let sentCount = 0
  let failedCount = 0
  let firstError: string | null = null

  for (const batch of chunk(recipients, RESEND_BATCH_SIZE)) {
    // The Resend SDK never throws for an API-level failure (bad key,
    // unverified domain, invalid recipient) — it always resolves to
    // { data, error }, so `error` is the only signal that a batch actually
    // failed. A try/catch here would never fire and was hiding failed sends
    // as "sent".
    const { data, error } = await resend.batch.send(
      batch.map((contact) => ({
        from: site.mailFrom,
        to: contact.email,
        subject,
        html: withUnsubscribeFooter(bodyHtml, contact.id),
      })),
    )

    if (error || !data) {
      failedCount += batch.length
      const message = error?.message ?? 'Error desconocido'
      firstError ??= message
      await supabase.from('campaign_sends').insert(
        batch.map((contact) => ({
          campaign_id: campaign.id,
          contact_id: contact.id,
          email: contact.email,
          status: 'failed',
          error: message,
        })),
      )
      continue
    }

    sentCount += batch.length
    await supabase.from('campaign_sends').insert(
      batch.map((contact, i) => ({
        campaign_id: campaign.id,
        contact_id: contact.id,
        email: contact.email,
        status: 'sent',
        sent_at: new Date().toISOString(),
        resend_email_id: data.data[i]?.id ?? null,
      })),
    )
  }

  await supabase
    .from('campaigns')
    .update({
      status: failedCount === recipients.length ? 'failed' : 'sent',
      sent_count: sentCount,
      failed_count: failedCount,
      sent_at: new Date().toISOString(),
    })
    .eq('id', campaign.id)

  revalidatePath('/admin/campanas')
  const errorParam = firstError ? `&error=${encodeURIComponent(firstError)}` : ''
  redirect(`/admin/campanas?sent=${sentCount}&failed=${failedCount}${errorParam}`)
}

// Sends one copy of the current draft to a single address without creating a
// campaign or touching campaign_sends — for checking a send actually lands
// before committing to the full recipient list.
export async function sendTestEmail(formData: FormData) {
  const subject = String(formData.get('subject') ?? '').trim()
  const bodyHtml = String(formData.get('body_html') ?? '').trim()
  const testEmail = String(formData.get('test_email') ?? '').trim()

  if (!subject || !bodyHtml || !testEmail) {
    redirect('/admin/campanas/nueva?error=missing_fields')
  }
  if (!isResendConfigured) {
    redirect('/admin/campanas/nueva?error=resend_not_configured')
  }

  const resend = createResendClient()
  const { error } = await resend.emails.send({
    from: site.mailFrom,
    to: testEmail,
    subject: `[PRUEBA] ${subject}`,
    html: withUnsubscribeFooter(bodyHtml, 'prueba'),
  })

  if (error) {
    redirect(`/admin/campanas/nueva?error=${encodeURIComponent(error.message)}`)
  }

  redirect(`/admin/campanas/nueva?test_sent=${encodeURIComponent(testEmail)}`)
}

// Turns on Resend's open/click tracking for the sending domain — required
// for campaign_sends.opened_at to ever get filled in by the webhook. A
// one-time account setting, exposed here so it doesn't need the Resend
// dashboard to switch on.
export async function enableOpenTracking() {
  if (!isResendConfigured) {
    redirect('/admin/campanas/nueva?error=resend_not_configured')
  }

  const domainName = getMailFromDomain()
  const resend = createResendClient()
  const { data, error: listError } = await resend.domains.list()

  if (listError || !data) {
    redirect(`/admin/campanas/nueva?error=${encodeURIComponent(listError?.message ?? 'No se pudo leer el dominio')}`)
  }

  const domain = data.data.find((d) => d.name === domainName)
  if (!domain) {
    redirect('/admin/campanas/nueva?error=domain_not_found')
  }

  const { error: updateError } = await resend.domains.update({
    id: domain.id,
    openTracking: true,
    clickTracking: true,
  })

  if (updateError) {
    redirect(`/admin/campanas/nueva?error=${encodeURIComponent(updateError.message)}`)
  }

  revalidatePath('/admin/campanas/nueva')
  redirect('/admin/campanas/nueva?tracking_enabled=1')
}
