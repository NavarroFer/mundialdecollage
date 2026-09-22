import { describe, expect, it } from 'vitest'
import { buildArtworkStats, formatShare } from './artwork-stats'

describe('buildArtworkStats', () => {
  it('includes missing techniques in the denominator and separates publication status', () => {
    const stats = buildArtworkStats([
      { technique: 'Analógica', profiles: { is_public: true } },
      { technique: 'Digital', profiles: { is_public: false } },
      { technique: null, profiles: { is_public: null } },
      { technique: ' ', profiles: { is_public: true } },
    ])
    expect(stats).toMatchObject({ total: 4, published: 2, pending: 2, withTechnique: 2 })
    expect(stats.techniques.find(t => t.label === 'Sin técnica registrada')?.count).toBe(2)
    expect(stats.techniques.reduce((sum, t) => sum + t.count, 0)).toBe(stats.total)
  })
  it('handles empty data without invalid percentages', () => {
    expect(buildArtworkStats([])).toMatchObject({ total: 0, published: 0, withTechnique: 0 })
    expect(formatShare(0, 0)).toBe('0%')
  })
  it('keeps small shares visible with a decimal', () => {
    expect(formatShare(1, 218)).toBe('0,5%')
  })
})
