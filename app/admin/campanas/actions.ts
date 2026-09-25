'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  createResendClient,
  createResendDomainClient,
  isResendConfigured,
  isResendDomainConfigured,
  isValidEmail,
  RESEND_BATCH_SIZE,
  getMailFromDomain,
} from '@/lib/resend'
import { site } from '@/lib/site'
import { isEmailDocument, personalizeHtml } from '@/lib/email-blocks'
import {
  contactLocale,
  emailFor,
  emailTextsFingerprint,
  extractEmailTexts,
  translatedLocales,
  withUnsubscribeFooter,
  type EmailTranslations,
  type TranslatedLocale,
} from '@/lib/email-translation'
import { isTranslatorConfigured, translateEmailTexts } from '@/lib/email-translator'
import { DEFAULT_LOCALE, isLocale, TRANSLATED_LOCALES, type Locale } from '@/lib/i18n/locales'
import type { SupabaseClient } from '@supabase/supabase-js'

// The translations this send can use. The template's own are reused while
// the composer still has its exact wording; anything edited (or written from
// scratch) is translated now, if the translator is set up. Raw-HTML emails
// and a missing translator mean Spanish for everyone.
async function translationsForSend(
  supabase: SupabaseClient,
  { templateId, subject, bodyJson, locales = TRANSLATED_LOCALES }: {
    templateId: string | null
    subject: string
    bodyJson: unknown
    locales?: readonly TranslatedLocale[]
  },
): Promise<{ translations: EmailTranslations; errors: string[] }> {
  if (!isEmailDocument(bodyJson)) return { translations: {}, errors: [] }
  const texts = extractEmailTexts(subject, bodyJson)

  if (templateId) {
    const { data: template } = await supabase
      .from('templates')
      .select('translations, translations_source')
      .eq('id', templateId)
      .maybeSingle()
    if (template?.translations_source === emailTextsFingerprint(subject, bodyJson)) {
      const complete = translatedLocales(template.translations as EmailTranslations, texts)
      if (locales.every((locale) => complete.includes(locale))) {
        return { translations: template.translations as EmailTranslations, errors: [] }
      }
    }
  }

  if (!isTranslatorConfigured) return { translations: {}, errors: [] }
  try {
    return await translateEmailTexts(texts, locales)
  } catch (error) {
    return { translations: {}, errors: [error instanceof Error ? error.message : String(error)] }
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

function parseBodyJson(formData: FormData) {
  const raw = formData.get('body_json')
  if (!raw) return null
  try {
    return JSON.parse(String(raw))
  } catch {
    return null
  }
}

export async function sendCampaign(formData: FormData) {
  const subject = String(formData.get('subject') ?? '').trim()
  const bodyHtml = String(formData.get('body_html') ?? '').trim()
  const bodyJson = parseBodyJson(formData)
  const templateId = String(formData.get('template_id') ?? '') || null

  if (!subject || !bodyHtml) {
    redirect('/admin/campanas/nueva?error=missing_fields')
  }
  if (!isResendConfigured) {
    redirect('/admin/campanas/nueva?error=resend_not_configured')
  }

  const supabase = await createClient()

  const [{ data: contacts }, { data: contactCountries }] = await Promise.all([
    supabase.from('contacts').select('id, email, name').eq('subscribed', true),
    supabase.rpc('contact_country_codes'),
  ])

  const countryByContact = new Map(
    ((contactCountries ?? []) as { contact_id: string; country_code: string | null }[]).map((row) => [
      row.contact_id,
      row.country_code,
    ]),
  )
  const recipients = (contacts ?? []).map((contact) => ({
    ...contact,
    locale: contactLocale(countryByContact.get(contact.id)),
  }))
  if (recipients.length === 0) {
    redirect('/admin/campanas/nueva?error=no_recipients')
  }

  const { translations, errors: translationErrors } = await translationsForSend(supabase, {
    templateId,
    subject,
    bodyJson,
  })
  const emails = new Map<Locale, ReturnType<typeof emailFor>>()
  const emailForContact = (locale: Locale) => {
    if (!emails.has(locale)) emails.set(locale, emailFor(locale, { subject, bodyHtml, bodyJson, translations }))
    return emails.get(locale)!
  }

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      template_id: templateId,
      subject,
      body_html: bodyHtml,
      body_json: bodyJson,
      translations,
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
  let firstError: string | null = translationErrors.length
    ? `No se pudo traducir (esos contactos recibieron español): ${translationErrors.join('; ')}`
    : null

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
  const bodyJson = parseBodyJson(formData)
  const templateId = String(formData.get('template_id') ?? '') || null
  const testEmail = String(formData.get('test_email') ?? '').trim()
  const requestedLocale = String(formData.get('test_locale') ?? '')
  const locale: Locale = isLocale(requestedLocale) ? requestedLocale : DEFAULT_LOCALE

  if (!subject || !bodyHtml || !testEmail) {
    redirect('/admin/campanas/nueva?error=missing_fields')
  }
  if (!isResendConfigured) {
    redirect('/admin/campanas/nueva?error=resend_not_configured')
  }

  // Only the one language being tested needs translating.
  const { translations, errors } =
    locale === 'es'
      ? { translations: {}, errors: [] }
      : await translationsForSend(await createClient(), { templateId, subject, bodyJson, locales: [locale] })
  const email = emailFor(locale, { subject, bodyHtml, bodyJson, translations })
  if (email.locale !== locale) {
    const reason = errors.length ? errors.join('; ') : 'no hay traducción disponible'
    redirect(`/admin/campanas/nueva?error=${encodeURIComponent(`No se pudo probar en ese idioma: ${reason}`)}`)
  }

  const resend = createResendClient()
  const { error } = await resend.emails.send({
    from: site.mailFrom,
    to: testEmail,
    subject: `[PRUEBA] ${email.subject}`,
    html: withUnsubscribeFooter(personalizeHtml(email.html, null), 'prueba', email.locale),
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
  if (!isResendDomainConfigured) {
    redirect('/admin/campanas/nueva?error=resend_domain_not_configured')
  }

  const domainName = getMailFromDomain()
  const resend = createResendDomainClient()
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

// Re-sends a campaign to the recipients whose send failed (a Resend error,
// e.g. the daily quota running out halfway through), with the same subject,
// body and translations it went out with. Retried rows are updated in place,
// so the campaign keeps one campaign_sends row per recipient. Contacts that
// were deleted, unsubscribed since, or have a malformed address stay failed.
export async function retryFailedSends(formData: FormData) {
  const campaignId = String(formData.get('campaign_id') ?? '')
  if (!campaignId) redirect('/admin/campanas')
  if (!isResendConfigured) {
    redirect(`/admin/campanas?error=${encodeURIComponent('Resend no está configurado')}`)
  }

  const supabase = await createClient()

  // Flipping to 'sending' only if it isn't already doubles as a lock: a
  // second click (or tab) finds no row to claim instead of re-sending twice.
  const { data: campaign } = await supabase
    .from('campaigns')
    .update({ status: 'sending' })
    .eq('id', campaignId)
    .neq('status', 'sending')
    .gt('failed_count', 0)
    .select('id, subject, body_html, body_json, translations, recipient_count, sent_count, failed_count')
    .maybeSingle()

  if (!campaign) {
    redirect(`/admin/campanas?error=${encodeURIComponent('Esa campaña ya se está enviando o no tiene fallidos')}`)
  }

  let retriedCount = 0
  let stillFailedCount = 0
  let skippedCount = 0
  let firstError: string | null = null

  try {
    const { data: failedSends } = await supabase
      .from('campaign_sends')
      .select('id, email, locale, contact:contacts(id, name, subscribed)')
      .eq('campaign_id', campaign.id)
      .eq('status', 'failed')

    const retryable = ((failedSends ?? []) as unknown as {
      id: string
      email: string
      locale: string | null
      contact: { id: string; name: string | null; subscribed: boolean } | null
    }[]).filter((send) => send.contact?.subscribed && isValidEmail(send.email))
    skippedCount = (failedSends?.length ?? 0) - retryable.length

    const translations = (campaign.translations ?? {}) as EmailTranslations
    const emails = new Map<Locale, ReturnType<typeof emailFor>>()
    const emailForLocale = (raw: string | null) => {
      const locale = raw && isLocale(raw) ? raw : DEFAULT_LOCALE
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

    const resend = createResendClient()
    for (const batch of chunk(retryable, RESEND_BATCH_SIZE)) {
      const { data, error } = await resend.batch.send(
        batch.map((send) => {
          const email = emailForLocale(send.locale)
          return {
            from: site.mailFrom,
            to: send.email,
            subject: email.subject,
            html: withUnsubscribeFooter(personalizeHtml(email.html, send.contact!.name), send.contact!.id, email.locale),
          }
        }),
      )

      if (error || !data) {
        stillFailedCount += batch.length
        const message = error?.message ?? 'Error desconocido'
        firstError ??= message
        await supabase.from('campaign_sends').upsert(
          batch.map((send) => ({ id: send.id, campaign_id: campaign.id, email: send.email, error: message })),
        )
        continue
      }

      retriedCount += batch.length
      const sentAt = new Date().toISOString()
      await supabase.from('campaign_sends').upsert(
        batch.map((send, i) => ({
          id: send.id,
          campaign_id: campaign.id,
          email: send.email,
          locale: emailForLocale(send.locale).locale,
          status: 'sent',
          error: null,
          sent_at: sentAt,
          resend_email_id: data.data[i]?.id ?? null,
        })),
      )
    }
  } finally {
    const failedCount = campaign.failed_count - retriedCount
    await supabase
      .from('campaigns')
      .update({
        status: failedCount === campaign.recipient_count ? 'failed' : 'sent',
        sent_count: campaign.sent_count + retriedCount,
        failed_count: failedCount,
      })
      .eq('id', campaign.id)
  }

  revalidatePath('/admin/campanas')
  const errorParam = firstError ? `&error=${encodeURIComponent(firstError)}` : ''
  redirect(
    `/admin/campanas?retried=${retriedCount}&failed=${stillFailedCount}&skipped=${skippedCount}${errorParam}`,
  )
}
