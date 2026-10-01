// Templates the app sends on its own (the 09:05 cron, app/api/cron/exhibition)
// rather than from /admin/campanas. They're ordinary rows in `templates`,
// found by `system_key`: /admin/plantillas creates them with the wording
// below the first time it's opened, and from then on the stored version —
// edits included — is what goes out, translated per recipient like any
// campaign.
import type { SupabaseClient } from '@supabase/supabase-js'
import { isEmailDocument, nextBlockId, renderEmailDocumentToHtml, type EmailBlock, type EmailDocument } from '@/lib/email-blocks'
import {
  applyEmailTexts,
  emailTextsFingerprint,
  extractEmailTexts,
  translatedLocales,
  type EmailTranslations,
  type TranslatedLocale,
} from '@/lib/email-translation'
import { isTranslatorConfigured, translateEmailTexts } from '@/lib/email-translator'
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locales'
import { getSiteUrl, site } from '@/lib/site'

export type SystemTemplateKey = 'museo_hoy' | 'novedades_obra' | 'confirmar_datos' | CountdownTemplateKey | ReceiptTemplateKey
export type ReceiptTemplateKey = 'compra_revista' | 'compra_suscripcion' | 'compra_obras'
export type CountdownTemplateKey = 'cuenta_regresiva_15' | 'cuenta_regresiva_7' | 'cuenta_regresiva_1'

type SystemTemplateDefinition = {
  name: string
  subject: string
  /** Shown on /admin/plantillas under the template's name. */
  description: string
  createDocument: (siteUrl: string) => EmailDocument
}

const logo = (siteUrl: string): EmailBlock =>
  ({ id: nextBlockId(), type: 'image', url: `${siteUrl}/logo.png`, alt: 'Mundial de Collage', link: siteUrl, widthPct: 40 })
const footer = (): EmailBlock[] => [
  { id: nextBlockId(), type: 'divider' },
  { id: nextBlockId(), type: 'text', text: 'Mundial Internacional de Collage', align: 'center' },
]

// The store, at the end of the daily «Así le fue a tu obra»: the artists
// reading it are the Mundial's warmest audience. ?desde=mail is how
// /tienda counts these visits (store_from_email in lib/funnel.ts).
const storeBlocks = (siteUrl: string): EmailBlock[] => [
  { id: nextBlockId(), type: 'divider' },
  {
    id: nextBlockId(),
    type: 'text',
    text: 'Papel por correo: el club mensual del Mundial de Collage. Cuadernos, láminas, fanzines y stickers armados a mano en Mar del Plata.',
    align: 'left',
  },
  { id: nextBlockId(), type: 'button', text: 'Ver la tienda', url: `${siteUrl}/tienda?desde=mail`, align: 'left', color: 'blue' },
]

// Stored novedades_obra templates last saved before the store blocks
// existed get them added once (see ensureSystemTemplate). Saved later, the
// stored version wins — an admin who removes them keeps it that way.
const STORE_BLOCKS_SHIPPED_AT = '2026-10-01T18:00:00Z'

// The countdown to the deadline (lib/countdown-campaigns.ts), sent to the
// contacts who haven't taken part yet. Same body, a different opening.
const countdown = (heading: string, opening: string) => (siteUrl: string): EmailDocument => ({
  blocks: [
    logo(siteUrl),
    { id: nextBlockId(), type: 'spacer', size: 'sm' },
    { id: nextBlockId(), type: 'heading', text: heading, align: 'left', size: 'md' },
    { id: nextBlockId(), type: 'text', text: opening, align: 'left' },
    {
      id: nextBlockId(),
      type: 'text',
      text: 'Participar es gratis: mandás una obra original y entrás en la evaluación del jurado internacional, en la Gran Muestra Online y en el índice de la Revista 1ª Edición, junto a artistas de todo el mundo.',
      align: 'left',
    },
    { id: nextBlockId(), type: 'button', text: 'Mandar mi obra', url: `${siteUrl}/onboarding`, align: 'left', color: 'red' },
    { id: nextBlockId(), type: 'text', text: '¿Conocés a alguien que hace collage? Reenviale este mail.', align: 'left' },
    ...footer(),
  ],
})

const COUNTDOWN_DESCRIPTION =
  'Se programa sola en Campañas para el público «No participan todavía» (cuenta regresiva al cierre de la convocatoria). Editala acá antes de su fecha; para no mandarla, cancelala en Campañas. Usá {{nombre}}.'

// Thank-you and confirmation after a purchase (lib/receipts.ts), sent once
// the payment is confirmed. Transactional: no unsubscribe link.
const RECEIPT_DESCRIPTION = 'Se envía sola apenas se confirma el pago. '

export const SYSTEM_TEMPLATES: Record<SystemTemplateKey, SystemTemplateDefinition> = {
  compra_revista: {
    name: 'Compra: Revista 1ª Edición',
    subject: '¡Gracias! Tu Revista del Mundial de Collage está reservada',
    description: RECEIPT_DESCRIPTION + 'Usá {{nombre}}, {{ejemplares}}, {{total}}, {{direccion}}, {{fecha_salida}} y {{pedido}}.',
    createDocument: (siteUrl) => ({
      blocks: [
        logo(siteUrl),
        { id: nextBlockId(), type: 'spacer', size: 'sm' },
        { id: nextBlockId(), type: 'heading', text: '¡Gracias, {{nombre}}!', align: 'left', size: 'md' },
        { id: nextBlockId(), type: 'text', text: 'Recibimos tu pago: tu ejemplar de la Revista del Mundial de Collage · 1ª edición está reservado.', align: 'left' },
        { id: nextBlockId(), type: 'text', text: 'Pedido: {{pedido}}\nEjemplares: {{ejemplares}}\nTotal pagado: {{total}}\nEnvío a: {{direccion}}', align: 'left' },
        { id: nextBlockId(), type: 'text', text: 'La revista sale el {{fecha_salida}}. Te volvemos a escribir cuando la despachemos. Si algo de la dirección está mal, respondé este mail.', align: 'left' },
        { id: nextBlockId(), type: 'button', text: 'Visitar el Mundial', url: siteUrl, align: 'left', color: 'red' },
        ...footer(),
      ],
    }),
  },
  compra_suscripcion: {
    name: 'Compra: suscripción Papel por correo',
    subject: '¡Bienvenida al club Papel por correo!',
    description: RECEIPT_DESCRIPTION + 'Usá {{nombre}}, {{plan}}, {{total}} (lo que se cobra por mes) y {{direccion}}.',
    createDocument: (siteUrl) => ({
      blocks: [
        logo(siteUrl),
        { id: nextBlockId(), type: 'spacer', size: 'sm' },
        { id: nextBlockId(), type: 'heading', text: '¡Gracias, {{nombre}}! Ya sos parte del club', align: 'left', size: 'md' },
        { id: nextBlockId(), type: 'text', text: 'Confirmamos tu suscripción a Papel por correo, el club mensual del Mundial de Collage.', align: 'left' },
        { id: nextBlockId(), type: 'text', text: 'Plan: {{plan}}\nCobro mensual: {{total}}\nEnvío a: {{direccion}}', align: 'left' },
        { id: nextBlockId(), type: 'text', text: 'Armamos cada edición a mano en Mar del Plata. Te avisamos por mail cuando despachemos la primera. Podés cancelar cuando quieras desde tu cuenta de pago; si necesitás cambiar la dirección, respondé este mail.', align: 'left' },
        { id: nextBlockId(), type: 'button', text: 'Ver la tienda', url: `${siteUrl}/tienda`, align: 'left', color: 'blue' },
        ...footer(),
      ],
    }),
  },
  compra_obras: {
    name: 'Compra: postular más obras',
    subject: 'Listo: ya podés postular más obras al Mundial de Collage',
    description: RECEIPT_DESCRIPTION + 'Usá {{nombre}}, {{total}} y {{limite}} (cuántas obras puede postular).',
    createDocument: (siteUrl) => ({
      blocks: [
        logo(siteUrl),
        { id: nextBlockId(), type: 'spacer', size: 'sm' },
        { id: nextBlockId(), type: 'heading', text: '¡Gracias, {{nombre}}!', align: 'left', size: 'md' },
        { id: nextBlockId(), type: 'text', text: 'Recibimos tu pago de {{total}}. Ya podés postular hasta {{limite}} obras al Mundial Internacional de Collage.', align: 'left' },
        { id: nextBlockId(), type: 'text', text: 'Entrá a tus obras para cargarlas y elegir cuáles participan.', align: 'left' },
        { id: nextBlockId(), type: 'button', text: 'Elegir mis obras', url: `${siteUrl}/onboarding/obras`, align: 'left', color: 'red' },
        ...footer(),
      ],
    }),
  },
  cuenta_regresiva_15: {
    name: 'Cuenta regresiva: quedan 15 días',
    subject: 'Quedan 15 días para participar del Mundial de Collage',
    description: COUNTDOWN_DESCRIPTION,
    createDocument: countdown(
      'Hola {{nombre}}, quedan 15 días',
      `La convocatoria del Mundial Internacional de Collage cierra el ${site.deadlineLabel}. Todavía estás a tiempo de sumar tu obra.`,
    ),
  },
  cuenta_regresiva_7: {
    name: 'Cuenta regresiva: queda una semana',
    subject: 'Queda una semana: sumá tu obra al Mundial de Collage',
    description: COUNTDOWN_DESCRIPTION,
    createDocument: countdown(
      'Hola {{nombre}}, queda una semana',
      `El ${site.deadlineLabel} cierra la convocatoria del Mundial Internacional de Collage. Si tenés una obra en mente, este es el momento.`,
    ),
  },
  cuenta_regresiva_1: {
    name: 'Cuenta regresiva: último día',
    subject: 'Mañana cierra el Mundial de Collage',
    description: COUNTDOWN_DESCRIPTION,
    createDocument: countdown(
      'Hola {{nombre}}, mañana cierra la convocatoria',
      `Es tu última oportunidad: el ${site.deadlineLabel} a medianoche (hora argentina) cerramos la recepción de obras del Mundial Internacional de Collage.`,
    ),
  },
  confirmar_datos: {
    name: 'Confirmación de datos: revisá tu participación',
    subject: '¿Revisamos tus datos para el Mundial de Collage?',
    description: 'Para el público «Datos por confirmar». Personaliza {{nombre_dato}}, {{pais_dato}}, {{obra_dato}} y {{datos_faltantes}} para cada artista. El botón abre la confirmación segura con Google.',
    createDocument: (siteUrl) => ({
      blocks: [
        logo(siteUrl),
        { id: nextBlockId(), type: 'spacer', size: 'sm' },
        { id: nextBlockId(), type: 'heading', text: 'Hola {{nombre}}, queremos confirmar tus datos', align: 'left', size: 'md' },
        { id: nextBlockId(), type: 'text', text: 'Estos son los datos que tenemos hoy:\n\nNombre: {{nombre_dato}}\nPaís: {{pais_dato}}\nObra: {{obra_dato}}', align: 'left' },
        { id: nextBlockId(), type: 'text', text: 'Necesitamos revisar: {{datos_faltantes}}. Si algo está mal o incompleto, podés corregirlo ahí mismo. Si está todo bien, sólo confirmalo.', align: 'left' },
        { id: nextBlockId(), type: 'button', text: 'Corregir o confirmar mis datos', url: `${siteUrl}/onboarding`, align: 'left', color: 'red' },
        { id: nextBlockId(), type: 'text', text: 'Por seguridad, el botón te va a pedir ingresar con la misma cuenta de Google que usaste para participar.', align: 'left' },
        ...footer(),
      ],
    }),
  },
  museo_hoy: {
    name: 'Aviso diario: tu obra está en el museo',
    subject: 'Hoy tu obra está en el museo del Mundial de Collage',
    description:
      'Se envía sola todos los días a las 9 h a los artistas que exponen ese día en la Galería 3D. Usá {{nombre}} y {{obra}} para el nombre y el título de la obra, y {{link_obra}} como link de un botón para que abra su obra directo en la galería.',
    createDocument: (siteUrl) => ({
      blocks: [
        logo(siteUrl),
        { id: nextBlockId(), type: 'spacer', size: 'sm' },
        { id: nextBlockId(), type: 'heading', text: 'Hola {{nombre}}, hoy tu obra está en el museo', align: 'left', size: 'md' },
        {
          id: nextBlockId(),
          type: 'text',
          text: 'Todos los días colgamos 20 obras del Mundial Internacional de Collage en nuestra Galería 3D, y hoy «{{obra}}» es una de ellas.',
          align: 'left',
        },
        {
          id: nextBlockId(),
          type: 'image',
          url: `${siteUrl}/email/galeria-3d.jpg`,
          alt: 'Una sala de la Galería 3D del Mundial de Collage, con obras colgadas y visitantes recorriéndola',
          link: `${siteUrl}/galeria-3d`,
          widthPct: 100,
        },
        {
          id: nextBlockId(),
          type: 'text',
          text: 'El botón de abajo abre tu obra directo en la galería. Compartí ese link con tu gente para que la vean y le dejen su like: mañana a las 9 la muestra cambia.',
          align: 'left',
        },
        { id: nextBlockId(), type: 'button', text: 'Ver mi obra en el museo', url: '{{link_obra}}', align: 'left', color: 'red' },
        ...footer(),
      ],
    }),
  },
  novedades_obra: {
    name: 'Aviso diario: así le fue a tu obra',
    subject: 'Así le fue a tu obra en el museo del Mundial de Collage',
    description:
      'Se envía sola a las 9 h a cada artista cuya obra recibió likes o comentarios aprobados en las últimas 24 horas (uno por día como máximo). Usá {{nombre}}, {{obra}}, {{likes}} (likes del día), {{likes_total}} y {{comentarios}}; el bloque con {{comentarios}} no se envía si no hubo comentarios nuevos.',
    createDocument: (siteUrl) => ({
      blocks: [
        logo(siteUrl),
        { id: nextBlockId(), type: 'spacer', size: 'sm' },
        { id: nextBlockId(), type: 'heading', text: 'Hola {{nombre}}, así le fue a «{{obra}}»', align: 'left', size: 'md' },
        {
          id: nextBlockId(),
          type: 'text',
          text: 'Esto pasó con tu obra en la Galería 3D del Mundial de Collage en las últimas 24 horas.',
          align: 'left',
        },
        { id: nextBlockId(), type: 'text', text: 'Likes nuevos: {{likes}}\nLikes en total: {{likes_total}}', align: 'left' },
        { id: nextBlockId(), type: 'text', text: 'Comentarios nuevos:\n{{comentarios}}', align: 'left' },
        {
          id: nextBlockId(),
          type: 'text',
          text: 'Todos los días hay 20 obras nuevas colgadas. Pasá a verlas y dejales tu like a otros artistas.',
          align: 'left',
        },
        { id: nextBlockId(), type: 'button', text: 'Visitar el museo', url: `${siteUrl}/galeria-3d`, align: 'left', color: 'red' },
        ...storeBlocks(siteUrl),
        ...footer(),
      ],
    }),
  },
}

export function isSystemTemplateKey(value: unknown): value is SystemTemplateKey {
  return typeof value === 'string' && value in SYSTEM_TEMPLATES
}

export type StoredTemplate = {
  id: string
  subject: string
  body_html: string
  body_json: unknown
  translations: EmailTranslations | null
  translations_source: string | null
}

const COLUMNS = 'id, subject, body_html, body_json, translations, translations_source'

// The stored template, created with the default wording if it isn't there
// yet. Works with an admin session or the service role.
export async function ensureSystemTemplate(db: SupabaseClient, key: SystemTemplateKey): Promise<StoredTemplate> {
  const find = () => db.from('templates').select(COLUMNS).eq('system_key', key).maybeSingle()

  const { data: existing } = await find()
  if (existing) {
    // Upgrade the short-lived generic draft shipped before personalized
    // profile-review tags existed. Once personalized (or manually edited),
    // the stored version remains the source of truth like every template.
    if (key === 'confirmar_datos' && existing.body_html.includes('nombre, país y título de obra')) {
      const definition = SYSTEM_TEMPLATES[key]
      const doc = definition.createDocument(getSiteUrl())
      const { data: upgraded } = await db.from('templates').update({
        name: definition.name,
        subject: definition.subject,
        body_json: doc,
        body_html: renderEmailDocumentToHtml(doc),
        translations: {},
        translations_source: null,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id).select(COLUMNS).single()
      if (upgraded) return upgraded as StoredTemplate
    }
    if (key === 'novedades_obra' && isEmailDocument(existing.body_json) && !existing.body_html.includes('/tienda')) {
      const upgraded = await addStoreBlocks(db, existing.id, existing.body_json)
      if (upgraded) return upgraded
    }
    return existing as StoredTemplate
  }

  const definition = SYSTEM_TEMPLATES[key]
  const doc = definition.createDocument(getSiteUrl())
  const { data, error } = await db.from('templates')
    .insert({
      name: definition.name,
      system_key: key,
      subject: definition.subject,
      body_json: doc,
      body_html: renderEmailDocumentToHtml(doc),
    })
    .select(COLUMNS)
    .single()
  if (data) return data as StoredTemplate

  // Someone else created it between the lookup and the insert (unique key).
  const { data: raced } = await find()
  if (raced) return raced as StoredTemplate
  throw new Error(`No se pudo crear la plantilla: ${error?.message}`)
}

async function addStoreBlocks(db: SupabaseClient, id: string, doc: EmailDocument): Promise<StoredTemplate | null> {
  const { data: meta } = await db.from('templates').select('updated_at').eq('id', id).single()
  if (!meta || new Date(meta.updated_at) >= new Date(STORE_BLOCKS_SHIPPED_AT)) return null
  // Before the closing footer (its divider) when there is one, else at the end.
  const footerAt = doc.blocks.findLastIndex((block) => block.type === 'divider')
  const at = footerAt === -1 ? doc.blocks.length : footerAt
  const upgradedDoc: EmailDocument = { ...doc, blocks: [...doc.blocks.slice(0, at), ...storeBlocks(getSiteUrl()), ...doc.blocks.slice(at)] }
  // Translations are keyed to the wording (translations_source), so the
  // next send notices the new text and translates it.
  const { data } = await db.from('templates').update({
    body_json: upgradedDoc,
    body_html: renderEmailDocumentToHtml(upgradedDoc),
    updated_at: new Date().toISOString(),
  }).eq('id', id).select(COLUMNS).single()
  return (data as StoredTemplate | null) ?? null
}

// Translations for the languages about to be sent: the template's own while
// they match its wording, the missing ones translated now and saved back
// onto the template so the next run reuses them. A language that can't be
// translated goes out in Spanish, same as campaigns.
export async function translationsForLocales(
  db: SupabaseClient,
  template: StoredTemplate,
  locales: Locale[],
): Promise<EmailTranslations> {
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
    if (errors.length) console.error('system template translation errors', errors)
    const merged = { ...current, ...fresh }
    await db.from('templates').update({ translations: merged, translations_source: fingerprint }).eq('id', template.id)
    return merged
  } catch (error) {
    console.error('system template translation failed', error)
    return current
  }
}

const tagPattern = (tag: string) => new RegExp(`\\{\\{\\s*${tag}\\s*\\}\\}`, 'gi')

/**
 * The template as one language receives it, rendered — the translation when
 * it's complete, else Spanish. Blocks mentioning any tag in `dropBlocksWith`
 * are left out (e.g. the comments block when there are no new comments).
 */
export function renderSystemEmail(
  template: StoredTemplate,
  locale: Locale,
  translations: EmailTranslations,
  { dropBlocksWith = [] }: { dropBlocksWith?: string[] } = {},
): { locale: Locale; subject: string; html: string } {
  if (!isEmailDocument(template.body_json)) {
    return { locale: DEFAULT_LOCALE, subject: template.subject, html: template.body_html }
  }
  const texts = extractEmailTexts(template.subject, template.body_json)
  const useTranslation = locale !== 'es' && translatedLocales(translations, texts).includes(locale as TranslatedLocale)
  const { subject, doc } = useTranslation
    ? applyEmailTexts(template.subject, template.body_json, translations[locale as TranslatedLocale]!)
    : { subject: template.subject, doc: template.body_json }
  const mentions = (block: EmailBlock) =>
    'text' in block && dropBlocksWith.some((tag) => tagPattern(tag).test(block.text))
  const blocks = doc.blocks.filter((block) => !mentions(block))
  return { locale: useTranslation ? locale : DEFAULT_LOCALE, subject, html: renderEmailDocumentToHtml({ blocks }) }
}

export function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// {{tag}} → `html`, already safe to insert. A replacer function so a value
// containing "$&" comes out literal (same reason as personalizeHtml).
export function fillTag(source: string, tag: string, html: string): string {
  return source.replace(tagPattern(tag), () => html)
}

/** {{tag}} → plain text, escaped. */
export function fillTextTag(source: string, tag: string, text: string): string {
  return fillTag(source, tag, escapeHtml(text))
}
