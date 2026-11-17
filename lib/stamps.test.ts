import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { MESSAGES } from '@/lib/i18n/messages'
import { ARTIST_STAMPS, LEGEND_STAMP, STAMP_KEYS, VISIT_STAMPS, VISITOR_STAMPS } from './stamps'

// The database's list of keys is the latest profile_stamps_stamp_key_check.
function databaseKeys(): string[] {
  const migrations = path.resolve(import.meta.dirname, '../supabase/migrations')
  const sql = readdirSync(migrations)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => readFileSync(path.join(migrations, file), 'utf8'))
    .join('\n')
  const checks = [...sql.matchAll(/add constraint profile_stamps_stamp_key_check check \(stamp_key in \(([^)]*)\)\)/g)]
  const last = checks.at(-1)
  if (!last) throw new Error('profile_stamps_stamp_key_check not found')
  return [...last[1].matchAll(/'([a-z]+)'/g)].map((match) => match[1])
}

describe('stamps', () => {
  it('are the same sixteen the database accepts', () => {
    expect(STAMP_KEYS).toHaveLength(16)
    expect([...STAMP_KEYS].sort()).toEqual(databaseKeys().sort())
  })

  it('belong to exactly one group', () => {
    expect(new Set(STAMP_KEYS).size).toBe(STAMP_KEYS.length)
    expect(VISITOR_STAMPS.length + ARTIST_STAMPS.length + 1).toBe(STAMP_KEYS.length)
    expect(STAMP_KEYS.at(-1)).toBe(LEGEND_STAMP)
  })

  it('let the browser report only the visit stamps', () => {
    expect([...VISIT_STAMPS]).toEqual(['gallery', 'world'])
  })

  it('have a title and a how-to in every language', () => {
    for (const [locale, messages] of Object.entries(MESSAGES)) {
      for (const key of STAMP_KEYS) {
        expect(messages.stamps[key].title.trim(), `${locale} ${key}`).not.toBe('')
        expect(messages.stamps[key].body.trim(), `${locale} ${key}`).not.toBe('')
      }
    }
  })
})
