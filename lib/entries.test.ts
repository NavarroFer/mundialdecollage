import { describe, expect, it } from 'vitest'
import { entryLimit, needsEntryChoice, resolveEntryChoice } from './entries'
import { site } from './site'

describe('entryLimit', () => {
  it('lets one obra take part for free and more after paying', () => {
    expect(entryLimit(false)).toBe(1)
    expect(entryLimit(true)).toBe(site.entries.paidLimit)
  })
})

describe('needsEntryChoice', () => {
  it('asks only artists with several obras who never chose', () => {
    expect(needsEntryChoice(1, null)).toBe(false)
    expect(needsEntryChoice(3, null)).toBe(true)
    expect(needsEntryChoice(3, '2026-09-26T12:00:00Z')).toBe(false)
  })
})

describe('resolveEntryChoice', () => {
  const ownedIds = ['a', 'b', 'c']

  it('makes the single free choice the main obra', () => {
    expect(resolveEntryChoice({ ownedIds, requestedIds: ['b'], currentMainId: 'a', limit: 1 })).toEqual({
      ok: true,
      entered: ['b'],
      main: 'b',
    })
  })

  it('refuses more obras than the limit', () => {
    expect(resolveEntryChoice({ ownedIds, requestedIds: ['a', 'b'], limit: 1 })).toEqual({ ok: false, error: 'too_many' })
  })

  it('refuses an obra the artist does not own', () => {
    expect(resolveEntryChoice({ ownedIds, requestedIds: ['z'], limit: 5 })).toEqual({ ok: false, error: 'not_owned' })
  })

  it('refuses an empty choice', () => {
    expect(resolveEntryChoice({ ownedIds, requestedIds: [''], limit: 5 })).toEqual({ ok: false, error: 'none' })
  })

  it('ignores a repeated id instead of counting it twice', () => {
    expect(resolveEntryChoice({ ownedIds, requestedIds: ['a', 'a'], limit: 1 })).toMatchObject({ ok: true, entered: ['a'] })
  })

  it('keeps the current main obra when it is still postulated and none was marked', () => {
    expect(resolveEntryChoice({ ownedIds, requestedIds: ['b', 'c'], currentMainId: 'c', limit: 5 })).toMatchObject({ main: 'c' })
  })

  it('never makes a non-postulated obra the main one', () => {
    expect(
      resolveEntryChoice({ ownedIds, requestedIds: ['b', 'c'], mainId: 'a', currentMainId: 'a', limit: 5 }),
    ).toMatchObject({ main: 'b' })
  })
})
