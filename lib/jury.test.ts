import { describe, expect, it } from 'vitest'
import { ITEM_KEY_PATTERN, jurorOrder, rankJuryPool, type JuryItem } from './jury'

const item = (key: string, number = 1): JuryItem => ({ key, number, imageUrl: '', title: null, technique: null, artist: null, countryCode: null })

describe('rankJuryPool', () => {
  const pool = [item('a'), item('b'), item('c'), item('d')]

  it('ranks by average, then by votes, unscored last, counting active jurors only', () => {
    const ranked = rankJuryPool(
      pool,
      [
        { juror_id: 'j1', item_key: 'a', score: 6, comment: null },
        { juror_id: 'j1', item_key: 'b', score: 8, comment: ' muy buena ' },
        { juror_id: 'j2', item_key: 'b', score: 8, comment: null },
        { juror_id: 'j1', item_key: 'c', score: 8, comment: null },
        { juror_id: 'gone', item_key: 'd', score: 10, comment: null },
      ],
      new Set(['j1', 'j2']),
    )
    expect(ranked.map((r) => [r.key, r.average, r.votes])).toEqual([
      ['b', 8, 2],
      ['c', 8, 1],
      ['a', 6, 1],
      ['d', null, 0],
    ])
    expect(ranked[0].comments).toEqual(['muy buena'])
  })
})

describe('ITEM_KEY_PATTERN', () => {
  it('accepts only the two sources with a uuid', () => {
    expect(ITEM_KEY_PATTERN.test('artwork:0b9c5d1e-1111-4222-8333-444455556666')).toBe(true)
    expect(ITEM_KEY_PATTERN.test('legacy:0b9c5d1e-1111-4222-8333-444455556666')).toBe(true)
    expect(ITEM_KEY_PATTERN.test('profile:0b9c5d1e-1111-4222-8333-444455556666')).toBe(false)
  })
})

describe('jurorOrder', () => {
  const pool = Array.from({ length: 20 }, (_, i) => item(`k${i}`, i + 1))

  it('is stable for a juror and different between jurors', () => {
    const first = jurorOrder(pool, 'juror-a').map((i) => i.key)
    expect(jurorOrder(pool, 'juror-a').map((i) => i.key)).toEqual(first)
    expect(jurorOrder(pool, 'juror-b').map((i) => i.key)).not.toEqual(first)
    expect([...first].sort()).toEqual(pool.map((i) => i.key).sort())
  })
})
