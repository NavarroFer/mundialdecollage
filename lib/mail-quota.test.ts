import { describe, expect, it } from 'vitest'
import { computeQuota, cycleStart, recipientCount, splitAcrossProviders, type MailProviderRow, type MailUsageRow } from './mail-quota'

const now = new Date('2026-10-02T15:00:00Z')

const row = (over: Partial<MailProviderRow> = {}): MailProviderRow => ({
  provider: 'resend',
  plan: 'Free',
  daily_limit: 100,
  monthly_limit: 3000,
  cycle_day: 1,
  used_today_offset: 0,
  used_cycle_offset: 0,
  offset_at: null,
  ...over,
})

const use = (sent: number, at: string, provider: MailUsageRow['provider'] = 'resend'): MailUsageRow => ({ provider, sent, sent_at: at })

describe('cycleStart', () => {
  it("is this month's renewal day once it has passed, the previous month's before", () => {
    expect(cycleStart(now, 1).toISOString()).toBe('2026-10-01T00:00:00.000Z')
    expect(cycleStart(now, 15).toISOString()).toBe('2026-09-15T00:00:00.000Z')
    expect(cycleStart(new Date('2026-01-10T00:00:00Z'), 20).toISOString()).toBe('2025-12-20T00:00:00.000Z')
  })
})

describe('computeQuota', () => {
  it('adds up the sends of today and of the cycle, per provider', () => {
    const q = computeQuota(row(), [
      use(10, '2026-10-02T01:00:00Z'),
      use(5, '2026-10-01T20:00:00Z'),
      use(7, '2026-09-30T20:00:00Z'),
      use(50, '2026-10-02T02:00:00Z', 'brevo'),
    ], now)
    expect(q).toMatchObject({ usedToday: 10, usedCycle: 15, remaining: 90 })
  })

  it('starts from what the dashboard showed, counting only sends after the sync', () => {
    const q = computeQuota(row({ used_today_offset: 2, used_cycle_offset: 778, offset_at: '2026-10-02T10:00:00Z' }), [
      use(30, '2026-10-02T09:00:00Z'),
      use(8, '2026-10-02T11:00:00Z'),
    ], now)
    expect(q).toMatchObject({ usedToday: 10, usedCycle: 786, remaining: 90 })
  })

  it('drops a sync from a previous day for the daily count, keeps it for the cycle', () => {
    const q = computeQuota(row({ used_today_offset: 99, used_cycle_offset: 2950, offset_at: '2026-10-01T23:00:00Z' }), [use(3, '2026-10-02T01:00:00Z')], now)
    expect(q).toMatchObject({ usedToday: 3, usedCycle: 2953, remaining: 47 })
  })

  it('takes the tighter of both limits, never below zero, and null without limits', () => {
    expect(computeQuota(row({ daily_limit: 300, monthly_limit: null }), [use(320, '2026-10-02T01:00:00Z')], now).remaining).toBe(0)
    expect(computeQuota(row({ daily_limit: null, monthly_limit: null }), [], now).remaining).toBeNull()
  })
})

describe('splitAcrossProviders', () => {
  const quota = (remaining: number | null) => ({ ...computeQuota(row(), [], now), remaining })

  it('fills providers in order, minus their reserve, and defers the rest', () => {
    expect(splitAcrossProviders(400, [
      { provider: 'brevo', quota: quota(300), reserve: 0 },
      { provider: 'resend', quota: quota(98), reserve: 20 },
    ])).toEqual({ take: { brevo: 300, resend: 78 }, deferred: 22 })
  })

  it('lets a provider without limits take everything left', () => {
    expect(splitAcrossProviders(50, [
      { provider: 'brevo', quota: quota(10), reserve: 0 },
      { provider: 'resend', quota: null, reserve: 20 },
    ])).toEqual({ take: { brevo: 10, resend: 40 }, deferred: 0 })
  })
})

describe('recipientCount', () => {
  it('counts to, cc and bcc', () => {
    expect(recipientCount({ to: 'a@x.com' })).toBe(1)
    expect(recipientCount({ to: ['a@x.com', 'b@x.com'], bcc: 'c@x.com' })).toBe(3)
  })
})
