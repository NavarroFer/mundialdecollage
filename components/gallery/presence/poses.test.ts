import { beforeEach, describe, expect, it } from 'vitest'
import { appearanceFor, parsePose, poseMessage, shouldSendPose, POSE_HEARTBEAT_MS, POSE_MIN_INTERVAL_MS } from './protocol'
import { peerPoses, prunePeerPoses, recordPeerPose } from './store'

const at = (t: number, x = 0, z = 0, h = 0) => ({ x, z, h, t })

describe('shouldSendPose', () => {
  it('always sends the first pose', () => {
    expect(shouldSendPose(null, at(0))).toBe(true)
  })
  it('throttles movement to a few messages a second', () => {
    expect(shouldSendPose(at(0), at(POSE_MIN_INTERVAL_MS - 1, 3))).toBe(false)
    expect(shouldSendPose(at(0), at(POSE_MIN_INTERVAL_MS, 3))).toBe(true)
  })
  it('stays quiet while standing still until the heartbeat', () => {
    expect(shouldSendPose(at(0), at(5000, 0.01, 0, 0.01))).toBe(false)
    expect(shouldSendPose(at(0), at(POSE_HEARTBEAT_MS))).toBe(true)
  })
  it('sends when only looking around, across the -π/π seam too', () => {
    expect(shouldSendPose(at(0, 0, 0, 0), at(500, 0, 0, 0.5))).toBe(true)
    expect(shouldSendPose(at(0, 0, 0, Math.PI - 0.01), at(500, 0, 0, -Math.PI + 0.01))).toBe(false)
  })
})

describe('parsePose', () => {
  it('round-trips what poseMessage sends', () => {
    expect(parsePose(poseMessage({ key: 'k', seq: 3, x: 1.234, z: -2.345, h: 0.5 }))).toEqual({ key: 'k', seq: 3, x: 1.23, z: -2.35, h: 0.5 })
  })
  it('keeps positions inside the gallery', () => {
    expect(parsePose({ k: 'k', s: 0, x: 999, z: -999, h: 0 })).toMatchObject({ x: 18, z: -5 })
  })
  it('rejects malformed messages', () => {
    expect(parsePose({ k: 'k', s: 0, x: Number.NaN, z: 0, h: 0 })).toBeNull()
    expect(parsePose({ k: 'k', s: -1, x: 0, z: 0, h: 0 })).toBeNull()
    expect(parsePose({ k: 'x'.repeat(65), s: 0, x: 0, z: 0, h: 0 })).toBeNull()
    expect(parsePose({ k: 'k', s: 0, x: '1', z: 0, h: 0 })).toBeNull()
    expect(parsePose(null)).toBeNull()
  })
})

describe('peer poses', () => {
  beforeEach(() => peerPoses.clear())
  it('ignores a pose that arrives after a newer one', () => {
    expect(recordPeerPose({ key: 'a', seq: 4, x: 4, z: 0, h: 0 }, 0)).toBe(true)
    expect(recordPeerPose({ key: 'a', seq: 3, x: 3, z: 0, h: 0 }, 1)).toBe(false)
    expect(peerPoses.get('a')?.x).toBe(4)
  })
  it('drops poses of visitors who left, but not ones that beat their presence join', () => {
    recordPeerPose({ key: 'gone', seq: 0, x: 0, z: 0, h: 0 }, 0)
    recordPeerPose({ key: 'early', seq: 0, x: 0, z: 0, h: 0 }, 9000)
    recordPeerPose({ key: 'here', seq: 0, x: 0, z: 0, h: 0 }, 0)
    prunePeerPoses(new Set(['here']), 10_000)
    expect([...peerPoses.keys()].sort()).toEqual(['early', 'here'])
  })
})

describe('appearanceFor', () => {
  it('gives the same visitor the same look every time', () => {
    expect(appearanceFor('abc', 5)).toEqual(appearanceFor('abc', 5))
    expect(appearanceFor('abc', 5).look).toBeLessThan(5)
  })
})
