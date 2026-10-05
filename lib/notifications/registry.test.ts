import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { MESSAGES } from '@/lib/i18n/messages'
import { NOTIFICATION_TYPES, renderNotification, type RenderContext } from './registry'

const NOW = new Date('2026-10-05T15:00:00Z')
const context: RenderContext = { locale: 'es', m: MESSAGES.es.notifications, untitled: MESSAGES.es.common.untitled, now: NOW }

describe('renderNotification', () => {
  it('skips types it does not know', () => {
    expect(renderNotification({ type: 'something_new', data: {} }, context)).toBeNull()
    expect(renderNotification({ type: 'toString', data: {} }, context)).toBeNull()
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
