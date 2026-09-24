import { describe, expect, it } from 'vitest'
import { parseReaction, summarizePresence } from './protocol'

const ids = new Set(['obra-a', 'obra-b'])

describe('summarizePresence', () => {
  it('counts everyone but lists only the other visitors', () => {
    const summary = summarizePresence({ me: [{}], zed: [{}], amy: [{}] }, 'me', ids)
    expect(summary.count).toBe(3)
    expect(summary.peers).toEqual(['amy', 'zed'])
  })
  it('tallies which obras other visitors have open, never the viewer', () => {
    const summary = summarizePresence({
      me: [{ viewing: 'obra-a' }],
      p1: [{ viewing: 'obra-a' }],
      p2: [{ viewing: 'obra-a' }],
      p3: [{ viewing: 'obra-b' }],
      p4: [{ viewing: null }],
    }, 'me', ids)
    expect(summary.viewers).toEqual({ 'obra-a': 2, 'obra-b': 1 })
  })
  it('ignores obras that are not in today\'s exhibition or malformed values', () => {
    const summary = summarizePresence({ p1: [{ viewing: 'otra' }], p2: [{ viewing: 42 }], p3: [] }, 'me', ids)
    expect(summary.viewers).toEqual({})
    expect(summary.count).toBe(3)
  })
})

describe('parseReaction', () => {
  it('accepts a known emoji on an obra from today\'s exhibition', () => {
    expect(parseReaction({ artworkId: 'obra-a', emoji: '🔥' }, ids)).toEqual({ artworkId: 'obra-a', emoji: '🔥' })
  })
  it('drops anything outside the fixed set or the exhibition', () => {
    expect(parseReaction({ artworkId: 'obra-a', emoji: '💩' }, ids)).toBeNull()
    expect(parseReaction({ artworkId: 'otra', emoji: '🔥' }, ids)).toBeNull()
    expect(parseReaction({ artworkId: 'obra-a', emoji: '<b>hola</b>' }, ids)).toBeNull()
    expect(parseReaction(null, ids)).toBeNull()
    expect(parseReaction('🔥', ids)).toBeNull()
  })
})
