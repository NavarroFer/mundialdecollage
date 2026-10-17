import { describe, expect, it } from 'vitest'
import { formatTotals, summarizeIncome } from './income'

describe('summarizeIncome', () => {
  const since = new Date('2026-10-10T00:00:00Z')

  it('adds each currency apart, pesos first, and counts the period', () => {
    const summary = summarizeIncome([
      { amount: 5, currency: 'USD', paidAt: '2026-10-16T12:00:00Z' },
      { amount: '10000', currency: 'ARS', paidAt: '2026-10-01T12:00:00Z' },
      { amount: 20000, currency: 'ARS', paidAt: '2026-10-15T12:00:00Z' },
      { amount: 1, currency: 'EUR', paidAt: null },
    ], since)
    expect(summary).toEqual({
      count: 4,
      recentCount: 2,
      totals: [{ currency: 'ARS', amount: 30000 }, { currency: 'USD', amount: 5 }, { currency: 'EUR', amount: 1 }],
    })
  })

  it('is empty with nothing paid', () => {
    expect(summarizeIncome([], since)).toEqual({ count: 0, recentCount: 0, totals: [] })
  })
})

describe('formatTotals', () => {
  it('says each currency in pesos-first order', () => {
    expect(formatTotals([{ currency: 'ARS', amount: 30000 }, { currency: 'USD', amount: 10 }]).replace(/\s/g, ' ')).toBe('$ 30.000 + US$ 10')
    expect(formatTotals([]).replace(/\s/g, ' ')).toBe('$ 0')
  })
})
