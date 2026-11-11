import { describe, expect, it } from 'vitest'
import { cleanBody, decodeCursor, encodeCursor, isOwnPostPath, parseFeedQuery, POST_BODY_MAX } from './community'

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
