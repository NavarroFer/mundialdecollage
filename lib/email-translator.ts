import Anthropic from '@anthropic-ai/sdk'
import { LOCALE_INFO, TRANSLATED_LOCALES } from '@/lib/i18n/locales'
import type { EmailTexts, EmailTranslations, TranslatedLocale } from '@/lib/email-translation'

// Same pattern as isResendConfigured: without a key, templates still save —
// they just stay Spanish-only and the admin panel says so.
export const isTranslatorConfigured = Boolean(process.env.ANTHROPIC_API_KEY)

const MODEL = 'claude-opus-5'

// How the contest is called on the public site in each language (see
// lib/i18n/messages), so mails and site match.
const BRAND: Record<TranslatedLocale, string> = {
  en: 'Collage World Cup (International Collage World Cup)',
  pt: 'Mundial de Colagem (Mundial Internacional de Colagem)',
  it: 'Mondiale di Collage (Mondiale Internazionale di Collage)',
  fr: 'Mondial du Collage (Mondial International du Collage)',
  de: 'Collage-WM (Internationale Collage-WM)',
  ru: 'Чемпионат мира по коллажу (Международный чемпионат мира по коллажу)',
  pl: 'Mistrzostwa Świata w Kolażu (Międzynarodowe Mistrzostwa Świata w Kolażu)',
  id: 'Piala Dunia Kolase (Piala Dunia Kolase Internasional)',
}

// Keyed items rather than an object with dynamic keys: structured outputs
// need every object's properties declared up front.
const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { key: { type: 'string' }, text: { type: 'string' } },
        required: ['key', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
} as const

function systemPrompt(locale: TranslatedLocale) {
  const language = LOCALE_INFO[locale].nameEs
  return `You translate newsletter emails for the Mundial Internacional de Collage, an international collage art contest run from Argentina, from Rioplatense Spanish into ${language} (${LOCALE_INFO[locale].intl}).

The readers are collage artists and art lovers. Keep the warm, direct, informal tone of the original, addressing the reader the way a friendly arts community would in ${language}. Call the contest "${BRAND[locale]}", matching the website.

Each item is one piece of the email: the subject line, a heading, a paragraph, a button label or an image description. Translate each one on its own terms, keeping it about as long as the original so it still fits its place in the layout.

Leave these exactly as they are: merge tags like {{nombre}} (keep the surrounding punctuation natural, e.g. a greeting followed by the tag), URLs, email addresses, @handles, emoji, and line breaks. People's names and artwork titles stay untranslated.

Return every key you receive, each with its translated text.`
}

async function translateInto(client: Anthropic, locale: TranslatedLocale, texts: EmailTexts): Promise<EmailTexts> {
  const items = Object.entries(texts).map(([key, text]) => ({ key, text }))
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: systemPrompt(locale),
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: OUTPUT_SCHEMA },
    },
    messages: [{ role: 'user', content: JSON.stringify({ items }) }],
  })

  if (response.stop_reason === 'refusal') throw new Error(`${LOCALE_INFO[locale].nameEs}: el modelo rechazó la traducción`)
  if (response.stop_reason === 'max_tokens') throw new Error(`${LOCALE_INFO[locale].nameEs}: la traducción quedó cortada`)

  const text = response.content.find((block) => block.type === 'text')?.text
  if (!text) throw new Error(`${LOCALE_INFO[locale].nameEs}: respuesta vacía`)
  const parsed = JSON.parse(text) as { items: { key: string; text: string }[] }

  const translated: EmailTexts = {}
  for (const { key, text: value } of parsed.items) {
    if (key in texts && value.trim()) translated[key] = value
  }
  const missing = Object.keys(texts).filter((key) => !translated[key])
  if (missing.length) throw new Error(`${LOCALE_INFO[locale].nameEs}: faltaron ${missing.length} textos`)
  return translated
}

/**
 * Translates an email's texts (see extractEmailTexts) into every non-Spanish
 * locale, one request per language in parallel. Languages that fail are left
 * out and reported in `errors`, so one bad response doesn't lose the rest.
 */
export async function translateEmailTexts(
  texts: EmailTexts,
  locales: readonly TranslatedLocale[] = TRANSLATED_LOCALES,
): Promise<{ translations: EmailTranslations; errors: string[] }> {
  const client = new Anthropic()
  const results = await Promise.allSettled(locales.map((locale) => translateInto(client, locale, texts)))

  const translations: EmailTranslations = {}
  const errors: string[] = []
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') translations[locales[index]] = result.value
    else errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason))
  })
  return { translations, errors }
}
