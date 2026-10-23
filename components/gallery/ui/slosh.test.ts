import { describe, expect, it } from 'vitest'
import { sloshSettled, sloshStep, sloshTilt, type Slosh } from './slosh'

// Frames at 60 fps until the liquid settles (or `limit` seconds).
function run(slosh: Slosh, target: number, calm = false, limit = 5) {
  const levels: number[] = []
  for (let t = 0; t < limit && !sloshSettled(slosh, target); t += 1 / 60) {
    sloshStep(slosh, target, 1 / 60, calm)
    levels.push(slosh.level)
  }
  return levels
}

describe('volume tank slosh', () => {
  it('settles on the level soon, so the tank stops drawing frames', () => {
    const slosh = { level: 0, speed: 0 }
    const levels = run(slosh, 60)
    expect(sloshSettled(slosh, 60)).toBe(true)
    expect(levels.length / 60).toBeLessThan(2)
  })
  it('sloshes past the level and back, unless motion is reduced', () => {
    expect(Math.max(...run({ level: 20, speed: 0 }, 60))).toBeGreaterThan(62)
    // Critically damped: at most a hair over from the integration, no visible slosh.
    expect(Math.max(...run({ level: 20, speed: 0 }, 60, true))).toBeLessThan(60.5)
  })
  it('stays inside the tank, splashing off its top and bottom', () => {
    for (const [from, to] of [[0, 100], [100, 0]]) {
      const levels = run({ level: from, speed: 0 }, to)
      expect(Math.min(...levels)).toBeGreaterThanOrEqual(0)
      expect(Math.max(...levels)).toBeLessThanOrEqual(100)
    }
  })
  it('leans while it moves, the way it goes, and lies flat at rest or with reduced motion', () => {
    expect(sloshTilt({ level: 50, speed: 300 }, false)).toBeGreaterThan(0)
    expect(sloshTilt({ level: 50, speed: -300 }, false)).toBeLessThan(0)
    expect(sloshTilt({ level: 50, speed: 1e6 }, false)).toBe(30)
    expect(sloshTilt({ level: 50, speed: 300 }, true)).toBe(0)
    expect(sloshTilt({ level: 50, speed: 0 }, false)).toBe(0)
  })
})
