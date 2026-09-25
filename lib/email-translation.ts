// Translating a block-based email (lib/email-blocks.ts) only ever touches its
// words: the subject plus each heading/text/button label and image alt text.
// URLs, images, layout and the {{nombre}} merge tag stay exactly as the
// Spanish original, so one template holds every language as a map of
// "which text" → "translated text" per locale.
// Pure (no server or DOM APIs): the campaign composer uses it in the browser too.
import { isEmailDocument, renderEmailDocumentToHtml, type EmailBlock, type EmailDocument } from '@/lib/email-blocks'
import { getSiteUrl } from '@/lib/site'
import { DEFAULT_LOCALE, localeForCountry, TRANSLATED_LOCALES, type Locale } from '@/lib/i18n/locales'

export type TranslatedLocale = (typeof TRANSLATED_LOCALES)[number]

/** Every translatable text in an email, keyed by where it goes. */
export type EmailTexts = Record<string, string>

/** What templates.translations / campaigns.translations store. */
export type EmailTranslations = Partial<Record<TranslatedLocale, EmailTexts>>

const SUBJECT_KEY = 'subject'

function blockTextKeys(block: EmailBlock): [key: string, text: string][] {
  switch (block.type) {
    case 'heading':
    case 'text':
    case 'button':
      return block.text.trim() ? [[`${block.id}.text`, block.text]] : []
    case 'image':
      return block.alt.trim() ? [[`${block.id}.alt`, block.alt]] : []
    default:
      return []
  }
}

export function extractEmailTexts(subject: string, doc: EmailDocument): EmailTexts {
  return Object.fromEntries([[SUBJECT_KEY, subject], ...doc.blocks.flatMap(blockTextKeys)])
}

/** The email in another language; any text missing from `texts` stays in Spanish. */
export function applyEmailTexts(subject: string, doc: EmailDocument, texts: EmailTexts): { subject: string; doc: EmailDocument } {
  return {
    subject: texts[SUBJECT_KEY] || subject,
    doc: {
      blocks: doc.blocks.map((block) => {
        if (block.type === 'image') return { ...block, alt: texts[`${block.id}.alt`] || block.alt }
        if (block.type === 'heading' || block.type === 'text' || block.type === 'button') {
          return { ...block, text: texts[`${block.id}.text`] || block.text }
        }
        return block
      }),
    },
  }
}

/**
 * Identifies the Spanish wording a set of translations was made from, so an
 * edit to any text marks them outdated — while swapping an image or a link
 * (which translations never copy) keeps them valid. FNV-1a: a short, stable
 * string hash that runs the same in the browser and on the server.
 */
export function emailTextsFingerprint(subject: string, doc: EmailDocument): string {
  const texts = extractEmailTexts(subject, doc)
  const input = JSON.stringify(Object.keys(texts).sort().map((key) => [key, texts[key]]))
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/** Locales with a complete translation (every text of the current email). */
export function translatedLocales(translations: EmailTranslations | null | undefined, texts: EmailTexts): TranslatedLocale[] {
  if (!translations) return []
  const keys = Object.keys(texts)
  return TRANSLATED_LOCALES.filter((locale) => {
    const localeTexts = translations[locale]
    return Boolean(localeTexts) && keys.every((key) => Boolean(localeTexts?.[key]?.trim()))
  })
}

export type TranslationStatus = 'translated' | 'outdated' | 'untranslated' | 'html'

/**
 * Where a template (or composed campaign) stands: translated into which
 * languages, or why it will go out in Spanish only. Translations only count
 * while the Spanish wording still matches the one they were made from.
 */
export function translationState(email: {
  subject: string
  body_json: unknown
  translations?: EmailTranslations | null
  translations_source?: string | null
}): { status: TranslationStatus; locales: TranslatedLocale[] } {
  if (!isEmailDocument(email.body_json)) return { status: 'html', locales: [] }
  const hasAny = Object.keys(email.translations ?? {}).length > 0
  if (!hasAny || !email.translations_source) return { status: 'untranslated', locales: [] }
  if (email.translations_source !== emailTextsFingerprint(email.subject, email.body_json)) {
    return { status: 'outdated', locales: [] }
  }
  const locales = translatedLocales(email.translations, extractEmailTexts(email.subject, email.body_json))
  return locales.length ? { status: 'translated', locales } : { status: 'untranslated', locales: [] }
}

/** A contact's email language: from their country, Spanish when unknown. */
export function contactLocale(countryCode: string | null | undefined): Locale {
  return localeForCountry(countryCode) ?? DEFAULT_LOCALE
}

// The unsubscribe footer every campaign mail ends with (campaigns in
// app/admin/campanas/actions.ts, the daily museum mail in
// app/api/cron/exhibition), in each recipient's language.
export const UNSUBSCRIBE_FOOTER: Record<Locale, { question: string; link: string }> = {
  es: { question: '¿No querés más estos mails?', link: 'Darte de baja' },
  en: { question: "Don't want these emails anymore?", link: 'Unsubscribe' },
  pt: { question: 'Não quer mais receber estes e-mails?', link: 'Cancelar inscrição' },
  it: { question: 'Non vuoi più ricevere queste email?', link: 'Annulla iscrizione' },
  fr: { question: 'Tu ne veux plus recevoir ces e-mails ?', link: 'Se désabonner' },
  de: { question: 'Du möchtest diese E-Mails nicht mehr bekommen?', link: 'Abmelden' },
  ru: { question: 'Больше не хотите получать эти письма?', link: 'Отписаться' },
  pl: { question: 'Nie chcesz już otrzymywać tych wiadomości?', link: 'Wypisz się' },
  id: { question: 'Tidak ingin menerima email ini lagi?', link: 'Berhenti berlangganan' },
}

export function withUnsubscribeFooter(bodyHtml: string, contactId: string, locale: Locale) {
  const unsubscribeUrl = `${getSiteUrl()}/api/unsubscribe?id=${contactId}`
  const footer = UNSUBSCRIBE_FOOTER[locale]
  return `${bodyHtml}<hr style="margin-top:32px;border:none;border-top:1px solid #ddd" /><p style="margin-top:16px;font-size:12px;color:#888">${footer.question} <a href="${unsubscribeUrl}">${footer.link}</a>.</p>`
}

// The email as one locale receives it (memoized per locale by the caller):
// the translated texts over the same blocks, or the Spanish original when
// that language has no complete translation.
export function emailFor(
  locale: Locale,
  { subject, bodyHtml, bodyJson, translations }: {
    subject: string
    bodyHtml: string
    bodyJson: unknown
    translations: EmailTranslations
  },
): { locale: Locale; subject: string; html: string } {
  const original = { locale: DEFAULT_LOCALE, subject, html: bodyHtml }
  if (locale === 'es' || !isEmailDocument(bodyJson)) return original
  if (!translatedLocales(translations, extractEmailTexts(subject, bodyJson)).includes(locale)) return original
  const translated = applyEmailTexts(subject, bodyJson, translations[locale]!)
  return { locale, subject: translated.subject, html: renderEmailDocumentToHtml(translated.doc) }
}
