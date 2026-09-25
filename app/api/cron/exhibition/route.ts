import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createResendClient, isResendConfigured } from '@/lib/resend'
import { isEmailDocument, personalizeHtml } from '@/lib/email-blocks'
import {
  emailFor,
  emailTextsFingerprint,
  extractEmailTexts,
  translatedLocales,
  withUnsubscribeFooter,
  type EmailTranslations,
  type TranslatedLocale,
} from '@/lib/email-translation'
import { isTranslatorConfigured, translateEmailTexts } from '@/lib/email-translator'
import {
  ensureExhibitionTemplate,
  fillArtworkTitle,
  planExhibitionMails,
  type ExhibitionQueueRow,
  type ExhibitionRecipient,
  type ExhibitionTemplate,
} from '@/lib/exhibition-mail'
import { ADMIN_EMAILS } from '@/lib/admin'
import { site } from '@/lib/site'
import type { Locale } from '@/lib/i18n/locales'

export const maxDuration = 120

// Vercel Cron calls this at 12:05 UTC (09:05 Argentina, right after the
// exhibition rotates) with `Authorization: Bearer $CRON_SECRET`. Safe to run
// again: only rows not yet handled get a mail. `?dry=1` shows who would get
// it without sending anything.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  const dryRun = request.nextUrl.searchParams.get('dry') === '1'

  try {
    const db = createAdminClient()
    const { error: lineupError } = await db.rpc('ensure_exhibition_today')
    if (lineupError) throw new Error(`No se pudo armar la muestra de hoy: ${lineupError.message}`)

    const { data: queue, error: queueError } = await db.rpc('exhibition_mail_queue')
    if (queueError) throw new Error(`No se pudo leer a quién avisar: ${queueError.message}`)

    const { send, skip } = planExhibitionMails((queue ?? []) as ExhibitionQueueRow[])
    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        send: send.map((r) => ({ email: r.email, name: r.artist_name, obra: r.artwork_title, locale: r.locale })),
        skip: skip.map(({ row, reason }) => ({ email: row.email, obra: row.artwork_title, reason })),
      })
    }
    if (!isResendConfigured) throw new Error('Resend no está configurado')

    const now = new Date().toISOString()
    for (const { row, reason } of skip) {
      await db.from('exhibition_days')
        .update({ notify_status: 'skipped', notify_error: reason, notified_at: now })
        .eq('day', row.day).eq('slot', row.slot).is('notify_status', null)
    }

    const recipients = await claim(db, send)
    let sent = 0
    let failed = 0
    let firstError: string | null = null

    if (recipients.length > 0) {
      const template = await ensureExhibitionTemplate(db)
      const translations = await translationsFor(db, template, recipients.map((r) => r.locale))
      const emails = new Map<Locale, ReturnType<typeof emailFor>>()
      const emailForLocale = (locale: Locale) => {
        if (!emails.has(locale)) {
          emails.set(locale, emailFor(locale, {
            subject: template.subject,
            bodyHtml: template.body_html,
            bodyJson: template.body_json,
            translations,
          }))
        }
        return emails.get(locale)!
      }

      // Resend's SDK resolves to { data, error } instead of throwing (see
      // app/admin/campanas/actions.ts); 20 mails fit in one batch call.
      const { data, error } = await createResendClient().batch.send(recipients.map((r) => {
        const email = emailForLocale(r.locale)
        const html = fillArtworkTitle(personalizeHtml(email.html, r.artist_name), r.artwork_title)
        return {
          from: site.mailFrom,
          to: r.email,
          subject: email.subject,
          html: withUnsubscribeFooter(html, r.contact_id, email.locale),
        }
      }))

      for (const [i, r] of recipients.entries()) {
        const update = error || !data
          ? { notify_status: 'failed', notify_error: error?.message ?? 'Error desconocido' }
          : { notify_status: 'sent', notify_error: null, resend_email_id: data.data[i]?.id ?? null }
        await db.from('exhibition_days')
          .update({ ...update, notified_at: new Date().toISOString() })
          .eq('day', r.day).eq('slot', r.slot)
      }
      if (error || !data) {
        failed = recipients.length
        firstError = error?.message ?? 'Error desconocido'
      } else {
        sent = recipients.length
      }
    }

    if (failed) await notifyAdmins(`El aviso "hoy tu obra está en el museo" falló para ${failed} artistas: ${firstError}`)
    return NextResponse.json({ sent, failed, skipped: skip.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('exhibition mail failed', message)
    await notifyAdmins(`El aviso "hoy tu obra está en el museo" no salió.\n\n${message}`)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Flips each row to 'sending' only if nobody else did first, so an
// overlapping run can't mail the same artist twice.
async function claim(db: SupabaseClient, recipients: ExhibitionRecipient[]) {
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

// Translations for today's languages: the template's own while they match
// its wording, the missing ones translated now and saved back onto the
// template so tomorrow reuses them. A language that can't be translated
// goes out in Spanish, same as campaigns.
async function translationsFor(db: SupabaseClient, template: ExhibitionTemplate, locales: Locale[]): Promise<EmailTranslations> {
  if (!isEmailDocument(template.body_json)) return {}
  const texts = extractEmailTexts(template.subject, template.body_json)
  const fingerprint = emailTextsFingerprint(template.subject, template.body_json)
  const current = template.translations_source === fingerprint ? template.translations ?? {} : {}
  const complete = translatedLocales(current, texts)
  const missing = [...new Set(locales)].filter(
    (locale): locale is TranslatedLocale => locale !== 'es' && !complete.includes(locale as TranslatedLocale),
  )
  if (missing.length === 0 || !isTranslatorConfigured) return current

  try {
    const { translations: fresh, errors } = await translateEmailTexts(texts, missing)
    if (errors.length) console.error('exhibition mail translation errors', errors)
    const merged = { ...current, ...fresh }
    await db.from('templates').update({ translations: merged, translations_source: fingerprint }).eq('id', template.id)
    return merged
  } catch (error) {
    console.error('exhibition mail translation failed', error)
    return current
  }
}

async function notifyAdmins(text: string) {
  if (!isResendConfigured) return
  const { error } = await createResendClient().emails.send({
    from: site.mailFrom,
    to: ADMIN_EMAILS,
    subject: 'Mundial de Collage · Aviso diario del museo',
    text,
  })
  if (error) console.error('exhibition notify failed', error)
}
