'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createResendClient, isResendConfigured, RESEND_BATCH_SIZE } from '@/lib/resend'
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

  for (const batch of chunk(recipients, RESEND_BATCH_SIZE)) {
    try {
      await resend.batch.send(
        batch.map((contact) => ({
          from: site.mailFrom,
          to: contact.email,
          subject,
          html: withUnsubscribeFooter(bodyHtml, contact.id),
        })),
      )
      sentCount += batch.length
      await supabase.from('campaign_sends').insert(
        batch.map((contact) => ({
          campaign_id: campaign.id,
          contact_id: contact.id,
          email: contact.email,
          status: 'sent',
          sent_at: new Date().toISOString(),
        })),
      )
    } catch (err) {
      failedCount += batch.length
      const message = err instanceof Error ? err.message : 'Error desconocido'
      await supabase.from('campaign_sends').insert(
        batch.map((contact) => ({
          campaign_id: campaign.id,
          contact_id: contact.id,
          email: contact.email,
          status: 'failed',
          error: message,
        })),
      )
    }
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
  redirect(`/admin/campanas?sent=${sentCount}&failed=${failedCount}`)
}
