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
import type { TemplateAudience } from '@/lib/template-audiences'

export type SystemTemplateKey = 'elegir_obra' | 'museo_hoy' | 'novedades_obra' | 'confirmar_datos' | 'certificado' | CountdownTemplateKey | ReceiptTemplateKey | JuryTemplateKey | 'bienvenida_hincha'
export type JuryTemplateKey = 'jurado_invitacion' | 'jurado_recordatorio'
export type ReceiptTemplateKey = 'compra_revista' | 'compra_suscripcion' | 'compra_obras'
export type CountdownTemplateKey = 'cuenta_regresiva_15' | 'cuenta_regresiva_7' | 'cuenta_regresiva_1'

type SystemTemplateDefinition = {
  name: string
  subject: string
  /** Shown on /admin/plantillas under the template's name. */
  description: string
  // Who it's for (lib/template-audiences.ts), stored on first creation.
  audiences: TemplateAudience[]
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
  elegir_obra: {
    name: 'Artistas: elegir una obra para participar',
    audiences: ['artistas'],
    subject: 'Elegí la obra con la que vas a participar en el Mundial de Collage',
    description: 'Para artistas con varias obras que todavía no eligieron cuál participa. Usá {{nombre}}, {{cantidad_obras}} y {{lista_obras}}. Campaña del 5 de noviembre de 2026, diez días antes del cierre.',
    createDocument: (siteUrl) => ({ blocks: [
      logo(siteUrl),
      { id: nextBlockId(), type: 'heading', text: 'Hola {{nombre}},', align: 'left', size: 'md' },
      { id: nextBlockId(), type: 'text', text: 'Tu participación ya está publicada en el Mundial Internacional de Collage y tenemos {{cantidad_obras}} obras tuyas cargadas:', align: 'left' },
      { id: nextBlockId(), type: 'text', text: '{{lista_obras}}', align: 'left' },
      { id: nextBlockId(), type: 'text', text: 'Para participar gratis en el concurso tenés que elegir una sola obra. Registrate en la página con el mismo correo al que recibís este mail; así vas a encontrar tus obras y podrás confirmar cuál querés presentar. Si ya tenés una cuenta, iniciá sesión.', align: 'left' },
      { id: nextBlockId(), type: 'button', text: 'Registrarme y elegir mi obra', url: `${siteUrl}/onboarding`, align: 'left', color: 'red' },
      { id: nextBlockId(), type: 'text', text: 'Tenés hasta el 15 de noviembre de 2026 para confirmar tu elección. ¡Faltan diez días para el cierre!', align: 'left' },
      ...footer(),
    ] }),
  },
  bienvenida_hincha: {
    name: 'Bienvenida: gracias por apoyar a un artista',
    audiences: ['hinchas'],
    subject: '¡Gracias por apoyar a {{artista}} en el Mundial de Collage!',
    description:
      'Se envía sola a las 9 h, una única vez, a quien dio su primer like o comentario en la Galería 3D el día anterior y no participa como artista (casi siempre amigos y familia de los artistas). Usá {{nombre}} (si comentó), {{artista}}, {{obra}} y {{link_obra}}; el bloque con {{convocatoria}} (la fecha de cierre) no se envía si la convocatoria ya cerró.',
    createDocument: (siteUrl) => ({
      blocks: [
        logo(siteUrl),
        { id: nextBlockId(), type: 'spacer', size: 'sm' },
        { id: nextBlockId(), type: 'heading', text: '¡Gracias por el aguante, {{nombre}}!', align: 'left', size: 'md' },
        {
          id: nextBlockId(),
          type: 'text',
          text: 'Tu apoyo a «{{obra}}», de {{artista}}, suma: cada like y cada comentario ayudan a que su obra llegue más lejos en el Mundial Internacional de Collage.',
          align: 'left',
        },
        { id: nextBlockId(), type: 'button', text: 'Ver la obra y compartirla', url: '{{link_obra}}', align: 'left', color: 'red' },
        {
          id: nextBlockId(),
          type: 'text',
          text: 'Un jurado internacional va a elegir las 30 obras finalistas, que se publican en la Revista 1ª Edición del Mundial. Te avisamos cuando las anunciemos.',
          align: 'left',
        },
        { id: nextBlockId(), type: 'button', text: 'Conocé la revista', url: `${siteUrl}/revista`, align: 'left', color: 'blue' },
        {
          id: nextBlockId(),
          type: 'text',
          text: '¿Vos también hacés collage? La convocatoria está abierta hasta el {{convocatoria}} y participar es gratis: entrá a mundialdecollage.com.ar y mandá tu obra.',
          align: 'left',
        },
        ...footer(),
      ],
    }),
  },
  // The jury's mails (lib/jury-mail.ts), sent through Resend to each juror.
  // Transactional: no unsubscribe link.
  jurado_invitacion: {
    name: 'Jurado: invitación',
    audiences: ['jurado'],
    subject: 'Te invitamos a ser jurado del Mundial de Collage',
    description:
      'Se envía sola al sumar (o reactivar) un jurado en Jurado, y con «Reenviar invitación». Usá {{nombre}}, {{obras}} (cuántas obras evalúa) y {{fecha_limite}} (o «a confirmar»).',
    createDocument: (siteUrl) => ({
      blocks: [
        logo(siteUrl),
        { id: nextBlockId(), type: 'spacer', size: 'sm' },
        { id: nextBlockId(), type: 'heading', text: 'Hola {{nombre}}, te invitamos a ser jurado', align: 'left', size: 'md' },
        {
          id: nextBlockId(),
          type: 'text',
          text: 'Gracias por sumarte al jurado del Mundial Internacional de Collage. Vas a evaluar {{obras}} obras preseleccionadas y puntuar cada una del 1 al 10. Las vas a ver sin el nombre ni el país de quien las hizo.',
          align: 'left',
        },
        { id: nextBlockId(), type: 'text', text: 'Fecha límite para votar: {{fecha_limite}}. Podés puntuar de a poco: lo que vas guardando queda registrado.', align: 'left' },
        { id: nextBlockId(), type: 'button', text: 'Empezar a evaluar', url: `${siteUrl}/jurado`, align: 'left', color: 'red' },
        { id: nextBlockId(), type: 'text', text: 'Para entrar, iniciá sesión con la cuenta de Google de este mail. Si tenés alguna duda, respondé este mensaje.', align: 'left' },
        ...footer(),
      ],
    }),
  },
  jurado_recordatorio: {
    name: 'Jurado: recordatorio',
    audiences: ['jurado'],
    subject: 'Te quedan obras por puntuar en el jurado del Mundial de Collage',
    description:
      'Se envía sola a las 9 h, 3 días y 1 día antes del cierre de la votación, a los jurados activos que tienen obras sin puntuar. Usá {{nombre}}, {{faltan}} (obras sin puntuar) y {{fecha_limite}}.',
    createDocument: (siteUrl) => ({
      blocks: [
        logo(siteUrl),
        { id: nextBlockId(), type: 'spacer', size: 'sm' },
        { id: nextBlockId(), type: 'heading', text: 'Hola {{nombre}}, te quedan obras por puntuar', align: 'left', size: 'md' },
        { id: nextBlockId(), type: 'text', text: 'La votación del jurado cierra el {{fecha_limite}}. Obras sin puntuar: {{faltan}}.', align: 'left' },
        { id: nextBlockId(), type: 'text', text: 'Lo que ya puntuaste quedó guardado: seguí desde donde dejaste.', align: 'left' },
        { id: nextBlockId(), type: 'button', text: 'Seguir evaluando', url: `${siteUrl}/jurado`, align: 'left', color: 'red' },
        { id: nextBlockId(), type: 'text', text: 'Entrá con la cuenta de Google de este mail.', align: 'left' },
        ...footer(),
      ],
    }),
  },
  compra_revista: {
    name: 'Compra: Revista 1ª Edición',
    audiences: ['clientes'],
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
    audiences: ['clientes'],
    subject: '¡Bienvenida al club Papel por correo!',
    description: RECEIPT_DESCRIPTION + 'Usá {{nombre}}, {{plan}}, {{total}} (lo que se cobra por mes), {{direccion}} y {{pickup_note}} (instrucciones de retiro para Argentina).',
    createDocument: (siteUrl) => ({
      blocks: [
        logo(siteUrl),
        { id: nextBlockId(), type: 'spacer', size: 'sm' },
        { id: nextBlockId(), type: 'heading', text: '¡Gracias, {{nombre}}! Ya sos parte del club', align: 'left', size: 'md' },
        { id: nextBlockId(), type: 'text', text: 'Confirmamos tu suscripción a Papel por correo, el club mensual del Mundial de Collage.', align: 'left' },
        { id: nextBlockId(), type: 'text', text: 'Plan: {{plan}}\nCobro mensual: {{total}}\nEnvío a: {{direccion}}', align: 'left' },
        { id: nextBlockId(), type: 'text', text: '{{pickup_note}}', align: 'left' },
        { id: nextBlockId(), type: 'text', text: 'Armamos cada edición a mano en Mar del Plata. Te avisamos por mail cuando despachemos la primera. Podés cancelar cuando quieras desde tu cuenta de pago; si necesitás cambiar el destino de envío, respondé este mail.', align: 'left' },
        { id: nextBlockId(), type: 'button', text: 'Ver la tienda', url: `${siteUrl}/tienda`, align: 'left', color: 'blue' },
        ...footer(),
      ],
    }),
  },
  compra_obras: {
    name: 'Compra: postular más obras',
    audiences: ['artistas', 'clientes'],
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
    audiences: ['interesados', 'hinchas'],
    subject: 'Quedan 15 días para participar del Mundial de Collage',
    description: COUNTDOWN_DESCRIPTION,
    createDocument: countdown(
      'Hola {{nombre}}, quedan 15 días',
      `La convocatoria del Mundial Internacional de Collage cierra el ${site.deadlineLabel}. Todavía estás a tiempo de sumar tu obra.`,
    ),
  },
  cuenta_regresiva_7: {
    name: 'Cuenta regresiva: queda una semana',
    audiences: ['interesados', 'hinchas'],
    subject: 'Queda una semana: sumá tu obra al Mundial de Collage',
    description: COUNTDOWN_DESCRIPTION,
    createDocument: countdown(
      'Hola {{nombre}}, queda una semana',
      `El ${site.deadlineLabel} cierra la convocatoria del Mundial Internacional de Collage. Si tenés una obra en mente, este es el momento.`,
    ),
  },
  cuenta_regresiva_1: {
    name: 'Cuenta regresiva: último día',
    audiences: ['interesados', 'hinchas'],
    subject: 'Mañana cierra el Mundial de Collage',
    description: COUNTDOWN_DESCRIPTION,
    createDocument: countdown(
      'Hola {{nombre}}, mañana cierra la convocatoria',
      `Es tu última oportunidad: el ${site.deadlineLabel} a medianoche (hora argentina) cerramos la recepción de obras del Mundial Internacional de Collage.`,
    ),
  },
  confirmar_datos: {
    name: 'Confirmación de datos: revisá tu participación',
    audiences: ['artistas'],
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
  // Mailed to every participant when the call closes (lib/certificate-mail.ts,
  // from /admin/convocatoria). The buttons' links carry a signed token
  // (lib/certificate-token.ts), so they work without signing in.
  certificado: {
    name: 'Certificado de participación',
    audiences: ['artistas'],
    subject: 'Tu certificado de participación en el Mundial de Collage',
    description:
      'Se envía una vez a cada artista participante al finalizar la convocatoria (o con «Enviar certificados pendientes» en Convocatoria). Usá {{nombre}} y {{obra}}, y {{link_pdf}} y {{link_imagen}} como links de los botones: abren el diploma y la imagen para Instagram sin iniciar sesión.',
    createDocument: (siteUrl) => ({
      blocks: [
        logo(siteUrl),
        { id: nextBlockId(), type: 'spacer', size: 'sm' },
        { id: nextBlockId(), type: 'heading', text: '¡Gracias, {{nombre}}!', align: 'left', size: 'md' },
        {
          id: nextBlockId(),
          type: 'text',
          text: 'Cerró la convocatoria de la 1ª edición del Mundial Internacional de Collage y queremos agradecerte por haber participado con «{{obra}}». Llegaron obras de artistas de todo el mundo, y la tuya es parte de esta primera edición.',
          align: 'left',
        },
        { id: nextBlockId(), type: 'text', text: 'Acá tenés tu certificado de participación: el diploma para imprimir y una imagen lista para compartir en Instagram.', align: 'left' },
        { id: nextBlockId(), type: 'button', text: 'Descargar el diploma (PDF)', url: '{{link_pdf}}', align: 'left', color: 'red' },
        { id: nextBlockId(), type: 'button', text: 'Imagen para Instagram', url: '{{link_imagen}}', align: 'left', color: 'blue' },
        { id: nextBlockId(), type: 'text', text: 'Ahora el jurado internacional evalúa las obras. Muy pronto anunciamos a los finalistas: estate atento a tu mail y a nuestras redes.', align: 'left' },
        ...footer(),
      ],
    }),
  },
  museo_hoy: {
    name: 'Aviso diario: tu obra está en el museo',
    audiences: ['artistas'],
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
    audiences: ['artistas'],
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
      audiences: definition.audiences,
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
