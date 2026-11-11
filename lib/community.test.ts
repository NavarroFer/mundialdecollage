import { describe, expect, it } from 'vitest'
import {
  cleanBody,
  decodeCursor,
  encodeCursor,
  isOwnPostPath,
  parseFeedQuery,
  POST_BODY_MAX,
  rankForTaste,
  tasteFromRows,
  tasteScore,
} from './community'

const id = '11111111-2222-4333-8444-555555555555'
const at = '2026-11-11T18:00:00.000Z'

describe('cursor', () => {
  it('round-trips a timestamp and an id', () => {
    expect(decodeCursor(encodeCursor(at, id))).toEqual({ at, id })
  })

  it('rejects a missing separator, a bad id and a bad time', () => {
    expect(decodeCursor(null)).toBeNull()
    expect(decodeCursor('')).toBeNull()
    expect(decodeCursor(at)).toBeNull()
    expect(decodeCursor(`${at}_not-a-uuid`)).toBeNull()
    expect(decodeCursor(`yesterday_${id}`)).toBeNull()
    expect(decodeCursor(`../${at}_${id}`)).toBeNull()
  })
})

describe('cleanBody', () => {
  it('trims and accepts an empty post', () => {
    expect(cleanBody('  hola  ', POST_BODY_MAX)).toBe('hola')
    expect(cleanBody('', POST_BODY_MAX)).toBe('')
    expect(cleanBody(null, POST_BODY_MAX)).toBe('')
  })

  it('rejects text that is too long and values that are not text', () => {
    expect(cleanBody('x'.repeat(POST_BODY_MAX + 1), POST_BODY_MAX)).toBeNull()
    expect(cleanBody(12, POST_BODY_MAX)).toBeNull()
  })
})

describe('isOwnPostPath', () => {
  const user = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
  const file = '11111111-2222-4333-8444-555555555555'

  it('accepts a file in the caller folder', () => {
    expect(isOwnPostPath(`${user}/${file}.jpg`, user)).toBe(true)
    expect(isOwnPostPath(`${user}/${file}.png`, user)).toBe(true)
    expect(isOwnPostPath(`${user}/${file}.webp`, user)).toBe(true)
  })

  it('rejects traversal, another folder and a disallowed extension', () => {
    expect(isOwnPostPath(`${user}/../${file}.jpg`, user)).toBe(false)
    expect(isOwnPostPath(`../${user}/${file}.jpg`, user)).toBe(false)
    expect(isOwnPostPath(`${file}/${file}.jpg`, user)).toBe(false)
    expect(isOwnPostPath(`${user}/${file}.gif`, user)).toBe(false)
    expect(isOwnPostPath(`${user}/${file}.jpg.exe`, user)).toBe(false)
  })
})

describe('parseFeedQuery', () => {
  it('defaults the page size and the language', () => {
    expect(parseFeedQuery(new URLSearchParams())).toEqual({
      cursor: null, author: null, limit: 20, lang: 'es', highlights: false,
    })
  })

  it('reads a cursor, an author and the home strip', () => {
    const params = new URLSearchParams({ antes: encodeCursor(at, id), autor: id.toUpperCase(), n: '6', lang: 'en', destacadas: '1' })
    expect(parseFeedQuery(params)).toMatchObject({ author: id, limit: 6, lang: 'en', highlights: true, cursor: null })
  })

  it('rejects a broken cursor, author, size or language', () => {
    expect(parseFeedQuery(new URLSearchParams({ antes: 'nope' }))).toBeNull()
    expect(parseFeedQuery(new URLSearchParams({ autor: 'ana' }))).toBeNull()
    expect(parseFeedQuery(new URLSearchParams({ n: '0' }))).toBeNull()
    expect(parseFeedQuery(new URLSearchParams({ n: '21' }))).toBeNull()
    expect(parseFeedQuery(new URLSearchParams({ lang: 'english' }))).toBeNull()
  })
})

describe('taste', () => {
  const day = (n: number) => `2026-11-${String(n).padStart(2, '0')}T12:00:00.000Z`
  const post = (id: string, overrides: Partial<{
    tags: string[]
    pinned: boolean
    createdAt: string
    likes: number
    comments: number
  }> = {}) => ({
    id,
    tags: [] as string[],
    pinned: false,
    createdAt: day(1),
    likes: 0,
    comments: 0,
    ...overrides,
  })

  it('keeps the exact order without a taste and never mutates the input', () => {
    const items = [post('a', { likes: 9 }), post('b', { pinned: true }), post('c', { createdAt: day(9) })]
    const snapshot = items.map((item) => ({ ...item }))
    const ranked = rankForTaste(items, {})

    expect(ranked.map((item) => item.id)).toEqual(['a', 'b', 'c'])
    expect(ranked).not.toBe(items)
    expect(items).toEqual(snapshot)
  })

  it('moves a strong match up and keeps the original order on a tie', () => {
    const items = [
      post('sin-gusto', { likes: 5 }),
      post('match', { tags: ['retrato'] }),
      post('empate-a', { tags: ['retrato'] }),
    ]
    const ranked = rankForTaste(items, { retrato: 1 })
    expect(ranked.map((item) => item.id)).toEqual(['match', 'empate-a', 'sin-gusto'])
  })

  it('puts a pinned item first even when its taste is 0', () => {
    const items = [
      post('match', { tags: ['retrato'] }),
      post('pinned', { pinned: true, likes: 0 }),
    ]
    expect(rankForTaste(items, { retrato: 1 }).map((item) => item.id)).toEqual(['pinned', 'match'])
  })

  it('breaks a taste tie with popularity', () => {
    const items = [
      post('menos', { tags: ['retrato'], likes: 1 }),
      post('mas', { tags: ['retrato'], likes: 10 }),
    ]
    expect(rankForTaste(items, { retrato: 1 }).map((item) => item.id)).toEqual(['mas', 'menos'])
  })

  it('tasteScore counts repeated tags once and ignores tags without a weight', () => {
    expect(tasteScore(['retrato', 'retrato', 'naturaleza', 'humor'], { retrato: 0.5, naturaleza: 0.25 })).toBe(0.75)
    expect(tasteScore(['desconocida'], { retrato: 1 })).toBe(0)
    expect(tasteScore([], { retrato: 1 })).toBe(0)
  })

  it('tasteFromRows drops invalid rows and returns a plain object', () => {
    const taste = tasteFromRows([
      { tag: 'retrato', weight: 0.9 },
      { tag: '', weight: 0.5 },
      { tag: 'naturaleza', weight: 0 },
      { tag: 'humor', weight: -1 },
      { tag: 'ciudad', weight: Number.NaN },
      { tag: 'digital', weight: Number.POSITIVE_INFINITY },
      { tag: ' oscuro ', weight: 0.4 },
    ])

    expect(taste).toEqual({ retrato: 0.9, oscuro: 0.4 })
    expect(Object.getPrototypeOf(taste)).toBe(Object.prototype)
  })
})
