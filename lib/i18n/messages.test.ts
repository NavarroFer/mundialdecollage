import { describe, expect, it } from 'vitest'
import { MESSAGES } from './messages'
import { fmt, formatDayMonth, plural } from './format'
import { LOCALES } from './locales'

// Every string leaf with its path, plural forms included.
function leaves(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]]
  if (Array.isArray(value)) return value.flatMap((item, i) => leaves(item, `${path}[${i}]`))
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => leaves(item, path ? `${path}.${key}` : key))
  }
  return []
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).filter((name) => name !== 'count').sort()

// Plural forms may drop {count} ("Otra persona…"), so compare them per message, not per form.
const messageKey = (path: string) => path.replace(/\.(zero|one|two|few|many|other)$/, '')

describe('dictionaries', () => {
  // Spanish leaves some notices empty on purpose (e.g. "the PDF is in Spanish").
  const spanish = new Map<string, string[] | null>()
  for (const [path, text] of leaves(MESSAGES.es)) spanish.set(messageKey(path), text ? placeholders(text) : null)

  for (const locale of LOCALES) {
    it(`${locale} uses the same placeholders as Spanish`, () => {
      for (const [path, text] of leaves(MESSAGES[locale])) {
        const expected = spanish.get(messageKey(path))
        if (expected === null) continue
        expect([path, placeholders(text)]).toEqual([path, expected ?? []])
      }
    })
  }

  it('fills placeholders and plural forms', () => {
    expect(fmt('Hola, {name}', { name: 'Ana' })).toBe('Hola, Ana')
    expect(plural('es', 1, MESSAGES.es.map.artworks)).toBe('1 obra')
    expect(plural('es', 1200, MESSAGES.es.map.artworks)).toBe('1.200 obras')
    expect(plural('pl', 3, MESSAGES.pl.map.artworks)).toBe('3 prace')
    expect(plural('pl', 5, MESSAGES.pl.map.artworks)).toBe('5 prac')
    expect(plural('id', 5, MESSAGES.id.map.artworks)).toBe('5 karya')
  })

  it('writes the deadline in each language', () => {
    expect(formatDayMonth('es', '2026-11-15T23:59:59-03:00')).toBe('15 de noviembre')
    expect(formatDayMonth('en', '2026-11-15T23:59:59-03:00')).toBe('November 15')
  })
})
