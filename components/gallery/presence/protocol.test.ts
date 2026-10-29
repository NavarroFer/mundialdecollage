import { describe, expect, it } from 'vitest'
import { summarizePresence } from './protocol'

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
  it('tells whether a Club gallery\'s member is in the room, never counting the viewer', () => {
    expect(summarizePresence({ me: [{ host: true }], p1: [{}] }, 'me', ids).hostHere).toBe(false)
    expect(summarizePresence({ me: [{}], p1: [{ host: true }] }, 'me', ids).hostHere).toBe(true)
    expect(summarizePresence({ me: [{}], p1: [{ host: 'yes' }] }, 'me', ids).hostHere).toBe(false)
  })
  it('ignores obras that are not in today\'s exhibition or malformed values', () => {
    const summary = summarizePresence({ p1: [{ viewing: 'otra' }], p2: [{ viewing: 42 }], p3: [] }, 'me', ids)
    expect(summary.viewers).toEqual({})
    expect(summary.count).toBe(3)
  })
})
