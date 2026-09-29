// Sending a campaign that's already a `campaigns` row: shared by the "Enviar"
// button (sendCampaign in app/admin/campanas/actions.ts) and the daily cron
// that sends scheduled ones (app/api/cron/campanas). Works with either the
// admin's own client or the service-role one.
import type { SupabaseClient } from '@supabase/supabase-js'
import { createResendClient, isValidEmail, RESEND_BATCH_SIZE } from '@/lib/resend'
import { site } from '@/lib/site'
import { personalizeHtml } from '@/lib/email-blocks'
import { contactLocale, emailFor, withUnsubscribeFooter, type EmailTranslations } from '@/lib/email-translation'
import { audienceContacts, parseAudience } from '@/lib/campaign-audience'
import type { Locale } from '@/lib/i18n/locales'

export type CampaignRecipient = { id: string; email: string; name: string | null; locale: Locale }

export type DeliverableCampaign = {
  id: string
  subject: string
  body_html: string
  body_json: unknown
  translations: EmailTranslations | null
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

// The audience's subscribed contacts, each with the language of their
// country. `error` is set when the audience couldn't be worked out — never
// fall back to everyone in that case.
export async function campaignRecipients(
  supabase: SupabaseClient,
  audienceInput: unknown,
): Promise<{ recipients: CampaignRecipient[]; error: string | null }> {
  const [{ contacts, error }, { data: contactCountries }] = await Promise.all([
    audienceContacts(supabase, parseAudience(audienceInput)),
    supabase.rpc('contact_country_codes'),
  ])
  if (error) return { recipients: [], error }

  const countryByContact = new Map(
    ((contactCountries ?? []) as { contact_id: string; country_code: string | null }[]).map((row) => [
      row.contact_id,
      row.country_code,
    ]),
  )
  return {
    recipients: contacts.map((contact) => ({ ...contact, locale: contactLocale(countryByContact.get(contact.id)) })),
    error: null,
  }
}

// Mails every recipient, records one campaign_sends row each and closes the
// campaign as 'sent' (or 'failed' when nothing went out). The caller must
// have already claimed the campaign by flipping it to 'sending'.
export async function deliverCampaign(
  supabase: SupabaseClient,
  campaign: DeliverableCampaign,
  recipients: CampaignRecipient[],
): Promise<{ sentCount: number; failedCount: number; firstError: string | null }> {
  const translations = campaign.translations ?? {}
  const emails = new Map<Locale, ReturnType<typeof emailFor>>()
  const emailForContact = (locale: Locale) => {
    if (!emails.has(locale)) {
      emails.set(
        locale,
        emailFor(locale, {
          subject: campaign.subject,
          bodyHtml: campaign.body_html,
          bodyJson: campaign.body_json,
          translations,
        }),
      )
    }
    return emails.get(locale)!
  }

  let sentCount = 0
  let failedCount = 0
  let firstError: string | null = null

  try {
    const resend = createResendClient()

    // A malformed address fails Resend's *entire* batch.send call, marking
    // every recipient in that batch as failed even though only one was bad.
    // Screen those out up front so one bad row in `contacts` can't take down
    // sends to everyone else.
    const validRecipients = recipients.filter((contact) => isValidEmail(contact.email))
    const invalidRecipients = recipients.filter((contact) => !isValidEmail(contact.email))

    if (invalidRecipients.length > 0) {
      failedCount += invalidRecipients.length
      firstError ??= 'Formato de email inválido'
      await supabase.from('campaign_sends').insert(
        invalidRecipients.map((contact) => ({
          campaign_id: campaign.id,
          contact_id: contact.id,
          email: contact.email,
          locale: emailForContact(contact.locale).locale,
          status: 'failed',
          error: 'Formato de email inválido',
        })),
      )
    }

    for (const batch of chunk(validRecipients, RESEND_BATCH_SIZE)) {
      // The Resend SDK never throws for an API-level failure (bad key,
      // unverified domain, invalid recipient) — it always resolves to
      // { data, error }, so `error` is the only signal that a batch actually
      // failed. A try/catch here would never fire and was hiding failed sends
      // as "sent".
      const { data, error } = await resend.batch.send(
        batch.map((contact) => {
          const email = emailForContact(contact.locale)
          return {
            from: site.mailFrom,
            to: contact.email,
            subject: email.subject,
            html: withUnsubscribeFooter(personalizeHtml(email.html, contact.name), contact.id, email.locale),
          }
        }),
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
            locale: emailForContact(contact.locale).locale,
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
          locale: emailForContact(contact.locale).locale,
          status: 'sent',
          sent_at: new Date().toISOString(),
          resend_email_id: data.data[i]?.id ?? null,
        })),
      )
    }
  } finally {
    // Whatever didn't get a campaign_sends row (a crash mid-way) counts as
    // failed rather than leaving the campaign stuck in 'sending'.
    failedCount = recipients.length - sentCount
    await supabase
      .from('campaigns')
      .update({
        status: sentCount === 0 ? 'failed' : 'sent',
        recipient_count: recipients.length,
        sent_count: sentCount,
        failed_count: failedCount,
        sent_at: new Date().toISOString(),
      })
      .eq('id', campaign.id)
  }

  return { sentCount, failedCount, firstError }
}
