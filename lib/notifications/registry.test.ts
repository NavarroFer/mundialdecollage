import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { MESSAGES } from '@/lib/i18n/messages'
import type { Locale } from '@/lib/i18n/locales'
import { NOTIFICATION_TYPES, renderNotification, type RenderContext } from './registry'

const NOW = new Date('2026-10-05T15:00:00Z') // exhibition day 2026-10-05

function context(locale: Locale = 'es'): RenderContext {
  return { locale, m: MESSAGES[locale].notifications, untitled: MESSAGES[locale].common.untitled, now: NOW }
}

describe('renderNotification', () => {
  it('reads a comment approval and links to the obra in the gallery', () => {
    expect(renderNotification({ type: 'comment_approved', data: { title: 'Recortes', slug: 'recortes' } }, context())).toEqual({
      text: 'Tu comentario en «Recortes» ya se ve en la Galería 3D.',
      href: '/galeria-3d?obra=recortes',
      icon: 'comment',
    })
  })

  it('names an untitled obra the way the site does', () => {
    expect(renderNotification({ type: 'comment_approved', data: { title: null, slug: 'x' } }, context())?.text).toBe(
      'Tu comentario en «Sin título» ya se ve en la Galería 3D.',
    )
  })

  it('joins likes and comments with the language’s own "and"', () => {
    const row = { type: 'artwork_activity', data: { title: 'Recortes', slug: 'recortes', likes: 3, comments: 1 } }
    expect(renderNotification(row, context())?.text).toBe('Tu obra «Recortes» sumó 3 me gusta y 1 comentario.')
    expect(renderNotification(row, context('en'))?.text).toBe('Your artwork “Recortes” got 3 likes and 1 comment.')
    expect(renderNotification({ ...row, data: { ...row.data, likes: 5, comments: 0 } }, context('ru'))?.text).toBe(
      'Ваша работа «Recortes» получила 5 отметок «Нравится».',
    )
  })

  it('skips activity with nothing to report', () => {
    expect(renderNotification({ type: 'artwork_activity', data: { title: 'x', slug: 'x', likes: 0, comments: 0 } }, context())).toBeNull()
  })

  it('says "hoy" only on the exhibition day itself', () => {
    const today = renderNotification({ type: 'artwork_exhibited', data: { title: 'Recortes', slug: 'recortes', day: '2026-10-05' } }, context())
    expect(today?.text).toBe('Hoy tu obra «Recortes» está en la Galería 3D. ¡Andá a verla!')
    const before = renderNotification({ type: 'artwork_exhibited', data: { title: 'Recortes', slug: 'recortes', day: '2026-10-01' } }, context())
    expect(before?.text).toBe('Tu obra «Recortes» estuvo en la Galería 3D el 1 de octubre.')
  })

  it('thanks the referrer by name, or without one', () => {
    expect(renderNotification({ type: 'referral_joined', data: { name: ' Inés ', slug: 'ines' } }, context())).toMatchObject({
      text: 'Inés se sumó al Mundial con tu link. ¡Gracias por compartir!',
      href: '/obras/ines',
    })
    expect(renderNotification({ type: 'referral_joined', data: { name: null, slug: null } }, context())).toMatchObject({
      text: 'Alguien se sumó al Mundial con tu link. ¡Gracias por compartir!',
      href: null,
    })
  })

  it('writes the admin notices in Spanish whatever the reader’s language', () => {
    expect(renderNotification({ type: 'admin_comments_pending', data: { count: 1 } }, context('en'))).toEqual({
      text: 'Hay 1 comentario esperando moderación.',
      href: '/admin/comentarios',
      icon: 'pending',
    })
    expect(renderNotification({ type: 'admin_wall_pending', data: { count: 4 } }, context())?.text).toBe(
      'Hay 4 fotos del collage colectivo para aprobar.',
    )
    expect(
      renderNotification({ type: 'admin_campaign_failed', data: { subject: 'Novedades', status: 'sent', failed: 3, total: 10 } }, context())?.text,
    ).toBe('En la campaña «Novedades» fallaron 3 de 10 envíos.')
    expect(
      renderNotification({ type: 'admin_magazine_paid', data: { name: 'Ana', quantity: 2, amount: 50000, currency: 'ARS' } }, context())?.text,
    ).toBe('Ana compró 2 ejemplares de la revista ($\u00a050.000).')
  })

  it('skips unknown types and data that does not match its type', () => {
    expect(renderNotification({ type: 'something_new', data: {} }, context())).toBeNull()
    expect(renderNotification({ type: 'admin_comments_pending', data: { count: 'many' } }, context())).toBeNull()
    expect(renderNotification({ type: 'admin_comments_pending', data: null }, context())).toBeNull()
    expect(renderNotification({ type: 'toString', data: {} }, context())).toBeNull()
  })

  it('renders every type in every language', () => {
    const samples: Record<keyof typeof NOTIFICATION_TYPES, unknown> = {
      comment_approved: { title: 'T', slug: 's' },
      wall_approved: {},
      wall_rejected: {},
      artwork_activity: { title: 'T', slug: 's', likes: 2, comments: 2 },
      artwork_exhibited: { title: 'T', slug: 's', day: '2026-10-05' },
      referral_joined: { name: 'N', slug: 's' },
      admin_comments_pending: { count: 2 },
      admin_wall_pending: { count: 2 },
      admin_images_failed: { count: 2 },
      admin_campaign_failed: { subject: 'S', status: 'failed', failed: 2, total: 2 },
      admin_magazine_paid: { name: 'N', quantity: 1, amount: 1, currency: 'ARS' },
      admin_entry_paid: { email: 'a@b.c', entries: 5, amount: 15, currency: 'USD' },
      admin_store_paid: { kind: 'one_time', amount: 15, currency: 'USD' },
    }
    for (const locale of Object.keys(MESSAGES) as Locale[]) {
      for (const [type, data] of Object.entries(samples)) {
        const rendered = renderNotification({ type, data }, context(locale))
        expect(rendered, `${locale} ${type}`).not.toBeNull()
        expect(rendered?.text, `${locale} ${type}`).not.toMatch(/\{\w+\}/)
      }
    }
  })
})

// The database writes the rows and this file reads them: a type a trigger
// writes but the registry doesn't know would be silently hidden. Every
// snake_case string in the notification migrations is a type — if one
// isn't, add it to NOT_TYPES.
describe('notification types written by the database', () => {
  const migrations = path.resolve(import.meta.dirname, '../../supabase/migrations')
  const sql = readdirSync(migrations)
    .filter((file) => file.endsWith('.sql'))
    .map((file) => readFileSync(path.join(migrations, file), 'utf8'))
    .filter((text) => /public\.notify_(user|admins)\(|on_admin_count_change\(/.test(text))
    .join('\n')
  const NOT_TYPES = new Set<string>([])
  const written = new Set([...sql.matchAll(/'([a-z]+(?:_[a-z]+)+)'/g)].map((match) => match[1]).filter((name) => !NOT_TYPES.has(name)))

  it('are all registered', () => {
    for (const type of written) expect(Object.keys(NOTIFICATION_TYPES), type).toContain(type)
  })

  it('cover every registered type', () => {
    for (const type of Object.keys(NOTIFICATION_TYPES)) expect([...written], type).toContain(type)
  })
})
