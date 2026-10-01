import { describe, expect, it } from 'vitest'
import { DISPUTED_MIN_GAP, DISPUTED_MIN_SPREAD, ITEM_KEY_PATTERN, jurorOrder, rankJuryPool, type JuryItem } from './jury'

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

describe('rankJuryPool — normalized score and disagreement', () => {
  const score = (juror_id: string, item_key: string, value: number) => ({ juror_id, item_key, score: value, comment: null })
  const keys = (items: { key: string }[]) => items.map((i) => i.key)

  // A strict juror who only uses 3–5 and a generous one who only uses 7–9,
  // each scoring a different part of the pool.
  const pool = ['s-low', 's-mid', 's-high', 'g-low', 'g-mid', 'g-high', 'none'].map((k, i) => item(k, i + 1))
  const scores = [
    score('strict', 's-low', 3), score('strict', 's-mid', 4), score('strict', 's-high', 5),
    score('generous', 'g-low', 7), score('generous', 'g-mid', 8), score('generous', 'g-high', 9),
  ]
  const jurors = new Set(['strict', 'generous'])

  it('defaults to the average, where every obra of the generous juror wins', () => {
    expect(keys(rankJuryPool(pool, scores, jurors))).toEqual(['g-high', 'g-mid', 'g-low', 's-high', 's-mid', 's-low', 'none'])
    expect(keys(rankJuryPool(pool, scores, jurors, 'promedio'))).toEqual(keys(rankJuryPool(pool, scores, jurors)))
  })

  it('puts each juror on their own scale, so strict and generous weigh the same', () => {
    const ranked = rankJuryPool(pool, scores, jurors, 'normalizado')
    const by = Object.fromEntries(ranked.map((r) => [r.key, r]))
    // Mean 4, sd 1 for the strict juror; mean 8, sd 1 for the generous one.
    expect(by['s-high'].normalized).toBeCloseTo(1)
    expect(by['g-high'].normalized).toBeCloseTo(1)
    expect(by['s-mid'].normalized).toBeCloseTo(0)
    expect(by['g-mid'].normalized).toBeCloseTo(0)
    expect(by['s-low'].normalized).toBeCloseTo(-1)
    expect(by['g-low'].normalized).toBeCloseTo(-1)
    expect(by.none.normalized).toBeNull()
    // Same z and votes: the raw average breaks the tie. Unscored stays last.
    expect(keys(ranked)).toEqual(['g-high', 's-high', 'g-mid', 's-mid', 'g-low', 's-low', 'none'])
  })

  it("averages an obra's z-scores across jurors", () => {
    const ranked = rankJuryPool(
      [item('a'), item('b')],
      [score('j1', 'a', 4), score('j1', 'b', 6), score('j2', 'a', 9), score('j2', 'b', 7)],
      new Set(['j1', 'j2']),
      'normalizado',
    )
    // j1 prefers b and j2 prefers a, by the same margin on their own scale.
    expect(ranked.find((r) => r.key === 'a')!.normalized).toBeCloseTo(0)
    expect(ranked.find((r) => r.key === 'b')!.normalized).toBeCloseTo(0)
  })

  it("ignores inactive jurors and scores outside the pool, also for each juror's scale", () => {
    const withNoise = [
      ...scores,
      score('gone', 's-low', 10),
      score('gone', 'none', 1),
      // Out of the pool: would shift the strict juror's mean and sd if counted.
      score('strict', 'archived', 10),
    ]
    const noisy = rankJuryPool(pool, withNoise, jurors, 'normalizado')
    expect(noisy).toEqual(rankJuryPool(pool, scores, jurors, 'normalizado'))
    expect(noisy.find((r) => r.key === 'none')!.votes).toBe(0)
  })

  it('gives z 0 when a juror has a single score or never varies', () => {
    const ranked = rankJuryPool(
      [item('a'), item('b'), item('c')],
      [score('once', 'a', 2), score('flat', 'b', 7), score('flat', 'c', 7)],
      new Set(['once', 'flat']),
      'normalizado',
    )
    expect(ranked.map((r) => r.normalized)).toEqual([0, 0, 0])
    // All tied at 0 with one vote each: the average decides.
    expect(keys(ranked)).toEqual(['b', 'c', 'a'])
  })

  it('breaks normalized ties by votes before the average', () => {
    const ranked = rankJuryPool(
      [item('one-vote'), item('two-votes')],
      [score('once', 'one-vote', 10), score('flat', 'two-votes', 5), score('flat2', 'two-votes', 5)],
      new Set(['once', 'flat', 'flat2']),
      'normalizado',
    )
    expect(keys(ranked)).toEqual(['two-votes', 'one-vote'])
  })

  it('reports spread, min and max, and flags the obras that divided the jury', () => {
    const ranked = rankJuryPool(
      [item('gap'), item('scattered'), item('close'), item('single'), item('none')],
      [
        score('j1', 'gap', 3), score('j2', 'gap', 8), // gap of 5
        score('j1', 'scattered', 4), score('j2', 'scattered', 8), // gap 4, but sd 2.83
        score('j1', 'close', 6), score('j2', 'close', 7), score('j3', 'close', 8),
        score('j1', 'single', 1),
      ],
      new Set(['j1', 'j2', 'j3']),
    )
    const by = Object.fromEntries(ranked.map((r) => [r.key, r]))
    expect([by.gap.min, by.gap.max, by.gap.disputed]).toEqual([3, 8, true])
    expect(by.scattered.spread).toBeCloseTo(Math.sqrt(8))
    expect(by.scattered.disputed).toBe(true)
    expect(by.close.spread).toBeCloseTo(1)
    expect([by.close.min, by.close.max, by.close.disputed]).toEqual([6, 8, false])
    expect([by.single.spread, by.single.min, by.single.max, by.single.disputed]).toEqual([null, 1, 1, false])
    expect([by.none.spread, by.none.min, by.none.max, by.none.disputed, by.none.average]).toEqual([null, null, null, false, null])
  })

  it('handles an empty pool and no scores', () => {
    expect(rankJuryPool([], scores, jurors, 'normalizado')).toEqual([])
    expect(rankJuryPool(pool, [], jurors, 'normalizado').every((r) => r.normalized === null && r.votes === 0)).toBe(true)
  })

  it('exports the disagreement thresholds', () => {
    expect([DISPUTED_MIN_GAP, DISPUTED_MIN_SPREAD]).toEqual([5, 2.5])
  })
})
