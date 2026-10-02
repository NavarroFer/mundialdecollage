// Sending a campaign that's already a `campaigns` row: shared by the "Enviar"
// button (sendCampaign in app/admin/campanas/actions.ts) and the daily cron
// that sends scheduled ones (app/api/cron/campanas). Works with either the
// admin's own client or the service-role one.
import type { SupabaseClient } from '@supabase/supabase-js'
import { isValidEmail } from '@/lib/resend'
import { sendMails } from '@/lib/mail'
import { personalizeHtmlWithValues } from '@/lib/email-blocks'
import { contactLocale, emailFor, withUnsubscribeFooter, type EmailTranslations } from '@/lib/email-translation'
import { audienceContacts, parseAudience } from '@/lib/campaign-audience'
import type { Locale } from '@/lib/i18n/locales'
import { countryCodeToName } from '@/lib/participants'
import type { ProfileReviewData } from '@/lib/campaign-audience'

export type CampaignRecipient = { id: string; email: string; name: string | null; locale: Locale; review?: ProfileReviewData }

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
    // Screen malformed addresses up front: one bad address in a Resend batch
    // fails the whole batch.
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

    const results = await sendMails(validRecipients.map((contact) => {
      const email = emailForContact(contact.locale)
      return {
        to: contact.email,
        subject: email.subject,
        html: withUnsubscribeFooter(personalizeHtmlWithValues(email.html, campaignRecipientValues(contact)), contact.id, email.locale),
      }
    }), { kind: 'bulk' })
    const sentAt = new Date().toISOString()
    const rows = validRecipients.map((contact, i) => {
      const result = results[i]
      const base = { campaign_id: campaign.id, contact_id: contact.id, email: contact.email, locale: emailForContact(contact.locale).locale }
      if (result.ok) return { ...base, status: 'sent', sent_at: sentAt, resend_email_id: result.id }
      firstError ??= result.error
      return { ...base, status: 'failed', error: result.error }
    })
    sentCount = rows.filter((row) => row.status === 'sent').length
    if (rows.length) {
      const { error: insertError } = await supabase.from('campaign_sends').insert(rows)
      if (insertError) console.error('campaign_sends insert failed', campaign.id, insertError)
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

export function campaignRecipientValues(contact: CampaignRecipient): Record<string, string | null | undefined> {
  const review = contact.review
  const missing = review?.missingFields ?? []
  return {
    nombre: review?.artistName || contact.name,
    nombre_dato: review?.artistName || 'Sin completar',
    pais_dato: review?.countryCode ? countryCodeToName(review.countryCode, contact.locale) : 'Sin completar',
    obra_dato: review?.artworkTitle || 'Sin título',
    datos_faltantes: missing.length ? missing.join(', ') : 'Sólo falta tu confirmación',
  }
}
