import { describe, expect, it } from 'vitest'
import { boundedDpr, FrameGovernor, initialQuality, parseGraphics, PRESETS } from './quality'

function run(governor: FrameGovernor, fps: number, seconds: number, quality: 'low' | 'medium' | 'high' | 'ultra' = 'high', ceiling: 'high' | 'ultra' = 'ultra') {
  const results = []
  for (let i = 0; i < fps * seconds; i++) {
    const result = governor.sample(1 / fps, quality, ceiling)
    if (result) results.push(result)
  }
  return results
}
describe('graphics policy', () => {
  it('starts phones and missing hardware hints conservatively', () => {
    expect(initialQuality({ mobile: true, cores: 8 })).toBe('medium')
    expect(initialQuality({ mobile: false })).toBe('medium')
    expect(initialQuality({ mobile: false, cores: 8 })).toBe('high')
    expect(initialQuality({ mobile: false, cores: 8, memory: 2 })).toBe('low')
    expect(initialQuality({ mobile: false, maxTextureSize: 2048 })).toBe('low')
  })
  it('bounds backing pixels even on large high-density mobile screens', () => {
    const dpr = boundedDpr('ultra', 1400, 1000, 3, true)
    expect(1400 * 1000 * dpr ** 2).toBeLessThanOrEqual(2_000_001)
    expect(boundedDpr('ultra', 400, 800, 1, true)).toBe(1)
    expect(boundedDpr('low', 400, 800, 3, true)).toBe(PRESETS.low.dpr)
  })
  it('validates saved choices and tolerates blocked/corrupt storage data', () => {
    expect(parseGraphics('broken')).toEqual({ selection: 'auto', adaptive: true })
    expect(parseGraphics('null')).toEqual({ selection: 'auto', adaptive: true })
    expect(parseGraphics('{"selection":"extreme","adaptive":0}')).toEqual({ selection: 'auto', adaptive: true })
    expect(parseGraphics('{"selection":"ultra","adaptive":false}')).toEqual({ selection: 'ultra', adaptive: false })
  })
  it('ignores warmup and transient stalls but reduces sustained low FPS', () => {
    const governor = new FrameGovernor()
    expect(run(governor, 30, 5)).toHaveLength(0)
    expect(run(governor, 30, 7).some((r) => r.next === 'medium')).toBe(true)
  })
  it('requires sustained headroom and respects the selected ceiling', () => {
    expect(run(new FrameGovernor(), 60, 25).every((r) => r.next === 'high')).toBe(true)
    expect(run(new FrameGovernor(), 60, 39).some((r) => r.next === 'ultra')).toBe(true)
    expect(run(new FrameGovernor(), 120, 45, 'high', 'high').every((r) => r.next === 'high')).toBe(true)
  })
  it('resets stale measurements after tab suspension and never goes below low', () => {
    const governor = new FrameGovernor()
    run(governor, 30, 8)
    expect(governor.sample(5, 'high', 'ultra')).toBeNull()
    expect(run(governor, 30, 5)).toHaveLength(0)
    expect(run(new FrameGovernor(), 20, 25, 'low').every((r) => r.next === 'low')).toBe(true)
  })
})
