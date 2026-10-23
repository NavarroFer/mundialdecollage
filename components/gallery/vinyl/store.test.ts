import { describe, expect, it } from 'vitest'
import { adjacentTrack, TRACKS } from './store'
import { findWalkPath, walkable } from '../navigation/path'
import { VINYL } from './store'

describe('gallery record console', () => {
  it('wraps the playlist in both directions', () => {
    expect(adjacentTrack(TRACKS.length - 1, 1)).toBe(0)
    expect(adjacentTrack(0, -1)).toBe(TRACKS.length - 1)
  })
  it('shuffle never repeats the current track', () => {
    for (let i = 0; i < TRACKS.length; i++) for (const random of [0, .2, .5, .999]) {
      const next = adjacentTrack(i, 1, true, () => random)
      expect(next).not.toBe(i)
      expect(next).toBeGreaterThanOrEqual(0)
      expect(next).toBeLessThan(TRACKS.length)
    }
  })
  it('includes four credited classics alongside the existing song', () => {
    expect(TRACKS).toHaveLength(5)
    expect(TRACKS.slice(1).every((track) => track.source && track.license && track.performer)).toBe(true)
  })
  it('keeps the console solid and its listening spot accessible', () => {
    expect(walkable(VINYL)).toBe(false)
    const to = { x: VINYL.x, z: VINYL.z + 1.7 }
    expect(walkable(to, true)).toBe(true)
    const from = { x: -6, z: -.2 }
    const route = findWalkPath(from, { x: -2, z: -.2 })!
    expect(route).not.toBeNull()
    let previous = from
    for (const point of route) {
      for (let i = 1; i <= 100; i++) expect(walkable({ x: previous.x + (point.x - previous.x) * i / 100, z: previous.z + (point.z - previous.z) * i / 100 })).toBe(true)
      previous = point
    }
  })
})
