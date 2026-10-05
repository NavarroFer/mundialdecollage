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

  it('renders every type', () => {
    const samples: Record<keyof typeof NOTIFICATION_TYPES, unknown> = {
      admin_comments_pending: { count: 2 },
      admin_wall_pending: { count: 2 },
      admin_images_failed: { count: 2 },
      admin_campaign_failed: { subject: 'S', status: 'failed', failed: 2, total: 2 },
      admin_magazine_paid: { name: 'N', quantity: 1, amount: 1, currency: 'ARS' },
      admin_entry_paid: { email: 'a@b.c', entries: 5, amount: 15, currency: 'USD' },
      admin_store_paid: { kind: 'one_time', amount: 15, currency: 'USD' },
    }
    for (const [type, data] of Object.entries(samples)) {
      const rendered = renderNotification({ type, data }, context())
      expect(rendered, type).not.toBeNull()
      expect(rendered?.text, type).not.toMatch(/\{\w+\}/)
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
