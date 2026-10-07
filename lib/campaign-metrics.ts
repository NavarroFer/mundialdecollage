export type CampaignMetrics = {
  sent_count: number
  delivered_count: number
  opened_count: number
  clicked_count: number
}

// Campaigns sent before engagement tracking was enabled contribute to send
// totals, but must not dilute engagement rates. Zero clicks still count when
// opens were observed (and vice versa). Rates are weighted by deliveries.
export function campaignEngagementTotals(campaigns: CampaignMetrics[]) {
  const tracked = campaigns.filter(c => c.opened_count > 0 || c.clicked_count > 0)
  return {
    campaigns: tracked.length,
    delivered: tracked.reduce((sum, c) => sum + (c.delivered_count || c.sent_count), 0),
    opened: tracked.reduce((sum, c) => sum + c.opened_count, 0),
    clicked: tracked.reduce((sum, c) => sum + c.clicked_count, 0),
  }
}
