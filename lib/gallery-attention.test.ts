import { describe, expect, it } from 'vitest'
import { attentionCandidate, createAttentionAccumulator, parseAttentionBatch, ATTENTION_MAX_MS } from './gallery-attention'

const target = { slug: 'obra-a', mode: 'view' as const }
const sessionId = '550e8400-e29b-41d4-a716-446655440000'
const accountId = sessionId
const row = { ...target, milliseconds: 2000, episodes: 1 }
function observe(counter: ReturnType<typeof createAttentionAccumulator>, from: number, to: number, next = target) {
  for (let now = from; now <= to; now += 250) counter.sample(next, now)
}
describe('attention counters', () => {
  it('ignores glances and credits a sustained observation once it qualifies', () => {
    const counter = createAttentionAccumulator()
    observe(counter, 0, 1750)
    expect(counter.snapshot()).toEqual([])
    counter.sample(target, 2000)
    counter.sample(target, 2250)
    expect(counter.snapshot()).toEqual([{ ...row, milliseconds: 2250 }])
  })
  it('never credits hidden/idle intervals, timer gaps or time before a new target', () => {
    const counter = createAttentionAccumulator()
    observe(counter, 0, 2000)
    counter.sample(null, 2250)
    observe(counter, 10000, 12000)
    counter.sample(target, 90000)
    expect(counter.snapshot()).toEqual([{ ...row, milliseconds: 4000, episodes: 2 }])
  })
  it('separates works and details without double-counting', () => {
    const counter = createAttentionAccumulator()
    observe(counter, 0, 2000)
    for (let now = 2250; now <= 4250; now += 250) counter.sample({ slug: 'obra-a', mode: 'details' }, now)
    observe(counter, 4500, 6500, { slug: 'obra-b', mode: 'view' })
    expect(counter.snapshot()).toEqual([row, { ...row, mode: 'details' }, { ...row, slug: 'obra-b' }])
  })
  it('does not expose mutable accumulator rows in a network snapshot', () => {
    const counter = createAttentionAccumulator()
    observe(counter, 0, 2000)
    counter.snapshot()[0].milliseconds = 999999
    expect(counter.snapshot()[0].milliseconds).toBe(2000)
  })
})
describe('attention payload', () => {
  it('normalizes allowed fields and ignores forged identity', () => {
    expect(parseAttentionBatch({ sessionId, accountId, rows: [row], userId: 'forged' })).toEqual({ sessionId, accountId, rows: [row] })
  })
  it('rejects invalid rows, duplicates and excessive totals', () => {
    for (const payload of [null, {}, { sessionId: 'bad', rows: [row] }, { sessionId, accountId, rows: [] }, { sessionId, accountId, rows: [null] }, { sessionId, accountId, rows: [row, row] }, { sessionId, accountId, rows: [{ ...row, milliseconds: NaN }] }, { sessionId, accountId, rows: [{ ...row, episodes: 2 }] }, { sessionId, accountId, rows: [{ ...row, mode: 'unknown' }] }, { sessionId, accountId, rows: [{ ...row, milliseconds: ATTENTION_MAX_MS }, { ...row, slug: 'b' }] }]) {
      expect(parseAttentionBatch(payload)).toBeNull()
    }
  })
})

describe('attention eligibility', () => {
  const eligible = { now: 10000, lastInput: 9500, enabled: true, visible: true, focused: true, walking: true, openId: null, ray: { slug: 'obra', sampledAt: 9900 } }
  it('pauses for hidden tabs, blur, menus, idle time, stale rays and stopped walks', () => {
    for (const patch of [{ visible: false }, { focused: false }, { enabled: false }, { now: 70000 }, { ray: { slug: 'obra', sampledAt: 0 } }, { walking: false }]) {
      expect(attentionCandidate({ ...eligible, ...patch })).toBeNull()
    }
  })
  it('counts details separately while the walk is paused', () => {
    expect(attentionCandidate(eligible)).toEqual({ slug: 'obra', mode: 'view' })
    expect(attentionCandidate({ ...eligible, walking: false, openId: 'otra' })).toEqual({ slug: 'otra', mode: 'details' })
  })
})
