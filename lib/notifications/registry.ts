import { z } from 'zod'
import { fmt, formatDayMonth, p, plural } from '@/lib/i18n/format'
import { LOCALE_INFO, type Locale } from '@/lib/i18n/locales'
import type { Messages } from '@/lib/i18n/messages/es'
import { galleryArtworkPath } from '@/lib/gallery-return'
import { exhibitionDay } from '@/lib/exhibition-day'

// Every kind of notification the bell can show, one entry each (a registry
// of strategies): what its `data` looks like, its icon, and how it reads and
// where it leads. The database writes the rows (the triggers in
// supabase/migrations/2026100512*_notifications.sql); this turns them into
// text in the reader's language. A row whose type isn't here, or whose
// data doesn't match, is skipped rather than shown broken.
//
// Adding a kind: a trigger that writes it, an entry here and, for visitors,
// its texts in every dictionary (lib/i18n/messages, `notifications.types`).
// Admin notices are in Spanish only, like the rest of the panel.

export type NotificationIcon =
  | 'comment'
  | 'wall'
  | 'wallRejected'
  | 'activity'
  | 'exhibition'
  | 'referral'
  | 'pending'
  | 'alert'
  | 'image'
  | 'money'

export type RenderContext = {
  locale: Locale
  m: Messages['notifications']
  /** What an obra without a title is called. */
  untitled: string
  now: Date
}

export type RenderedNotification = { text: string; href: string | null; icon: NotificationIcon }

type Definition<Schema extends z.ZodType> = {
  schema: Schema
  icon: NotificationIcon
  render: (data: z.infer<Schema>, context: RenderContext) => { text: string; href: string | null } | null
}

type RegisteredDefinition = {
  icon: NotificationIcon
  render: (data: unknown, context: RenderContext) => { text: string; href: string | null } | null
}

// Each entry validates its own data, so the registry can hold every kind
// behind one shape.
function define<Schema extends z.ZodType>({ schema, icon, render }: Definition<Schema>): RegisteredDefinition {
  return {
    icon,
    render: (data, context) => {
      const parsed = schema.safeParse(data)
      return parsed.success ? render(parsed.data, context) : null
    },
  }
}

const artworkData = { title: z.string().nullish(), slug: z.string().min(1).nullish() }
const countData = z.object({ count: z.number().int().positive() })
const moneyData = { amount: z.number().nonnegative(), currency: z.string().length(3) }

const obraLink = (slug: string | null | undefined) => (slug ? galleryArtworkPath(slug) : null)

function money(amount: number, currency: string): string {
  return new Intl.NumberFormat(LOCALE_INFO.es.intl, { style: 'currency', currency, maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(amount)
}

const ADMIN_TEXTS = {
  commentsPending: p({ one: 'Hay {count} comentario esperando moderación.', other: 'Hay {count} comentarios esperando moderación.' }),
  wallPending: p({ one: 'Hay {count} foto del collage colectivo para aprobar.', other: 'Hay {count} fotos del collage colectivo para aprobar.' }),
  imagesFailed: p({
    one: '{count} obra del registro no tiene imagen: no se pudo bajar de Drive.',
    other: '{count} obras del registro no tienen imagen: no se pudieron bajar de Drive.',
  }),
  magazineCopies: p({ one: '{count} ejemplar', other: '{count} ejemplares' }),
}

export const NOTIFICATION_TYPES = {
  // --- For visitors and artists -------------------------------------------
  comment_approved: define({
    schema: z.object(artworkData),
    icon: 'comment',
    render: (data, { m, untitled }) => ({
      text: fmt(m.types.commentApproved, { title: data.title || untitled }),
      href: obraLink(data.slug),
    }),
  }),
  wall_approved: define({
    schema: z.object({}),
    icon: 'wall',
    render: (_data, { m }) => ({ text: m.types.wallApproved, href: '/galeria-3d' }),
  }),
  wall_rejected: define({
    schema: z.object({}),
    icon: 'wallRejected',
    render: (_data, { m }) => ({ text: m.types.wallRejected, href: '/galeria-3d' }),
  }),
  artwork_activity: define({
    schema: z.object({ ...artworkData, likes: z.number().int().nonnegative(), comments: z.number().int().nonnegative() }),
    icon: 'activity',
    render: (data, { locale, m, untitled }) => {
      const parts = [
        data.likes > 0 && plural(locale, data.likes, m.types.likes),
        data.comments > 0 && plural(locale, data.comments, m.types.comments),
      ].filter((part): part is string => Boolean(part))
      if (!parts.length) return null
      const what = new Intl.ListFormat(LOCALE_INFO[locale].intl, { type: 'conjunction' }).format(parts)
      return { text: fmt(m.types.activity, { title: data.title || untitled, what }), href: obraLink(data.slug) }
    },
  }),
  artwork_exhibited: define({
    schema: z.object({ ...artworkData, day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
    icon: 'exhibition',
    render: (data, { locale, m, untitled, now }) => {
      const title = data.title || untitled
      const text = data.day === exhibitionDay(now)
        ? fmt(m.types.exhibitedToday, { title })
        : fmt(m.types.exhibitedOn, { title, date: formatDayMonth(locale, `${data.day}T12:00:00-03:00`) })
      return { text, href: obraLink(data.slug) }
    },
  }),
  referral_joined: define({
    schema: z.object({ name: z.string().nullish(), slug: z.string().min(1).nullish() }),
    icon: 'referral',
    render: (data, { m }) => ({
      text: data.name?.trim() ? fmt(m.types.referral, { name: data.name.trim() }) : m.types.referralSomeone,
      href: data.slug ? `/obras/${encodeURIComponent(data.slug)}` : null,
    }),
  }),

  // --- For the admins (Spanish only) --------------------------------------
  admin_comments_pending: define({
    schema: countData,
    icon: 'pending',
    render: ({ count }) => ({ text: plural('es', count, ADMIN_TEXTS.commentsPending), href: '/admin/comentarios' }),
  }),
  admin_wall_pending: define({
    schema: countData,
    icon: 'pending',
    render: ({ count }) => ({ text: plural('es', count, ADMIN_TEXTS.wallPending), href: '/admin/muro' }),
  }),
  admin_images_failed: define({
    schema: countData,
    icon: 'image',
    render: ({ count }) => ({ text: plural('es', count, ADMIN_TEXTS.imagesFailed), href: '/admin/obras' }),
  }),
  admin_campaign_failed: define({
    schema: z.object({
      subject: z.string(),
      status: z.enum(['sent', 'failed']),
      failed: z.number().int().positive(),
      total: z.number().int().nonnegative(),
    }),
    icon: 'alert',
    render: (data) => ({
      text: data.status === 'failed'
        ? `La campaña «${data.subject}» falló: no salió ningún mail.`
        : `En la campaña «${data.subject}» fallaron ${data.failed} de ${data.total} envíos.`,
      href: '/admin/campanas',
    }),
  }),
  admin_magazine_paid: define({
    schema: z.object({ name: z.string(), quantity: z.number().int().positive(), ...moneyData }),
    icon: 'money',
    render: (data) => ({
      text: `${data.name} compró ${plural('es', data.quantity, ADMIN_TEXTS.magazineCopies)} de la revista (${money(data.amount, data.currency)}).`,
      href: '/admin/revista',
    }),
  }),
  admin_entry_paid: define({
    schema: z.object({ email: z.string(), entries: z.number().int().positive(), ...moneyData }),
    icon: 'money',
    render: (data) => ({
      text: `${data.email} pagó para postular hasta ${data.entries} obras (${money(data.amount, data.currency)}).`,
      href: '/admin/pagos',
    }),
  }),
  admin_store_paid: define({
    schema: z.object({ kind: z.enum(['subscription', 'one_time']), ...moneyData }),
    icon: 'money',
    render: (data) => ({
      text: data.kind === 'subscription'
        ? `Cobro de una suscripción de la tienda: ${money(data.amount, data.currency)}.`
        : `Venta en la tienda: ${money(data.amount, data.currency)}.`,
      href: '/admin/tienda',
    }),
  }),
} satisfies Record<string, RegisteredDefinition>

export type NotificationType = keyof typeof NOTIFICATION_TYPES

export function isNotificationType(value: string): value is NotificationType {
  return Object.hasOwn(NOTIFICATION_TYPES, value)
}

/** The row as the bell shows it, or null when it can't be shown. */
export function renderNotification(row: { type: string; data: unknown }, context: RenderContext): RenderedNotification | null {
  if (!isNotificationType(row.type)) return null
  const definition: RegisteredDefinition = NOTIFICATION_TYPES[row.type]
  const rendered = definition.render(row.data, context)
  return rendered && { ...rendered, icon: definition.icon }
}
