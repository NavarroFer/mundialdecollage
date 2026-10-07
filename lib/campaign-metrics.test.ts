import { describe, expect, it } from 'vitest'
import { campaignEngagementTotals } from './campaign-metrics'

describe('campaign engagement totals', () => {
  it('excludes campaigns with zero engagement, even if delivery was tracked', () => {
    expect(campaignEngagementTotals([
      { sent_count: 1000, delivered_count: 900, opened_count: 0, clicked_count: 0 },
      { sent_count: 100, delivered_count: 80, opened_count: 40, clicked_count: 8 },
    ])).toEqual({ campaigns: 1, delivered: 80, opened: 40, clicked: 8 })
  })
  it('keeps a valid zero for a single metric and weights campaigns by deliveries', () => {
    expect(campaignEngagementTotals([
      { sent_count: 100, delivered_count: 100, opened_count: 50, clicked_count: 0 },
      { sent_count: 200, delivered_count: 0, opened_count: 0, clicked_count: 20 },
    ])).toEqual({ campaigns: 2, delivered: 300, opened: 50, clicked: 20 })
  })
  it('has no denominator when no engagement was observed', () => {
    expect(campaignEngagementTotals([{ sent_count: 100, delivered_count: 0, opened_count: 0, clicked_count: 0 }]))
      .toEqual({ campaigns: 0, delivered: 0, opened: 0, clicked: 0 })
  })
})
