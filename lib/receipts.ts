// Thank-you and confirmation mails after a purchase, from the editable system
// templates compra_revista / compra_suscripcion / compra_obras. Sent as
// transactional mail (lib/mail: Resend first, Brevo if Resend is out),
// in the buyer's language, plus a short heads-up to the admins.
//
// Each purchase row has receipt_sent_at: it's claimed (set) before sending,
// so the webhook and the return page — which can both apply the same payment
// — send it only once. If the send fails the claim is released, and the next
// time the payment is applied it's tried again.
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { isMailConfigured, sendMail } from '@/lib/mail'
import { ADMIN_EMAILS } from '@/lib/admin'
import { personalizeHtml } from '@/lib/email-blocks'
import { ensureSystemTemplate, fillTextTag, renderSystemEmail, translationsForLocales, type ReceiptTemplateKey } from '@/lib/system-templates'
import { localeForCountry, DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locales'
import { countryCodeToName } from '@/lib/participants'
import { getSiteUrl, site } from '@/lib/site'

type ReceiptTable = 'magazine_orders' | 'entry_purchases' | 'subscriptions'

export type Receipt = {
  to: string
  name: string | null
  locale: Locale
  tags: Record<string, string>
  /** One line for the admins' heads-up. */
  summary: string
}

export function formatMoney(amount: number, currency: string, locale: Locale = DEFAULT_LOCALE) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

/** A shipping address (PayPal's shape or the magazine's) on one line. */
export function formatAddress(address: Record<string, unknown> | null | undefined, locale: Locale = DEFAULT_LOCALE) {
  if (!address) return '—'
  const get = (key: string) => (typeof address[key] === 'string' ? (address[key] as string).trim() : '')
  const street = [get('address_line_1'), get('address_line_2')].filter(Boolean).join(', ')
  const city = get('city') || get('admin_area_2')
  const province = get('province') || get('admin_area_1')
  const country = get('country_code') || 'AR'
  const branch = get('delivery_type') === 'branch' ? `Correo Argentino · ${get('branch_name')} (${get('branch_code')})` : ''
  const recipient = get('delivery_type') === 'branch' ? get('recipient_name') : ''
  return [branch, recipient, street, [city, province].filter(Boolean).join(', '), get('postal_code'), countryCodeToName(country, locale)]
    .filter(Boolean)
    .join(' · ')
}

export const localeFromCountry = (countryCode: string | null | undefined) => localeForCountry(countryCode) ?? DEFAULT_LOCALE

async function claim(db: SupabaseClient, table: ReceiptTable, id: string) {
  const { data } = await db.from(table).update({ receipt_sent_at: new Date().toISOString() }).eq('id', id).is('receipt_sent_at', null).select('id')
  return Boolean(data?.length)
}

/**
 * Sends the receipt for one purchase unless it already went out. `build`
 * loads what the mail needs; it only runs once the purchase is claimed.
 * Never throws: a mail problem must not break the payment flow.
 */
export async function sendReceiptOnce(
  table: ReceiptTable,
  id: string,
  key: ReceiptTemplateKey,
  build: (db: SupabaseClient) => Promise<Receipt | null>,
) {
  if (!isMailConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return
  const db = createAdminClient()
  try {
    if (!(await claim(db, table, id))) return
    const receipt = await build(db)
    if (!receipt) return
    const template = await ensureSystemTemplate(db, key)
    const translations = await translationsForLocales(db, template, [receipt.locale])
    const email = renderSystemEmail(template, receipt.locale, translations)
    let html = personalizeHtml(email.html, receipt.name)
    let subject = email.subject
    for (const [tag, value] of Object.entries(receipt.tags)) {
      html = fillTextTag(html, tag, value)
      subject = fillTextTag(subject, tag, value)
    }
    if (receipt.tags.pickup_note && !email.html.includes('{{pickup_note}}')) html += fillTextTag('<p>{{pickup_note}}</p>', 'pickup_note', receipt.tags.pickup_note)
    const sent = await sendMail({ to: receipt.to, replyTo: site.email, subject, html })
    if (!sent.ok) {
      await db.from(table).update({ receipt_sent_at: null }).eq('id', id)
      console.error('receipt send failed', table, id, sent.error)
      return
    }
    const notified = await sendMail({
      to: ADMIN_EMAILS,
      subject: `Nueva venta · ${receipt.summary}`,
      text: `${receipt.summary}\n${receipt.to}\n\n${getSiteUrl()}/admin`,
    })
    if (!notified.ok) console.error('sale notification failed', table, id, notified.error)
  } catch (err) {
    await db.from(table).update({ receipt_sent_at: null }).eq('id', id)
    console.error('receipt failed', table, id, err)
  }
}
