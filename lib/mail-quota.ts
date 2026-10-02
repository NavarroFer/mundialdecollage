// How much each mail provider has left today and this month, so bulk sends
// (certificates) can split themselves across Resend and Brevo and leave the
// rest for the next day instead of hitting a quota error. Neither API reports
// usage: every accepted send is logged in mail_usage, on top of what the
// provider's dashboard showed when an admin last synced it from
// /admin/envios (supabase/migrations/20261002160000_mail_quota.sql).
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export type MailProvider = 'resend' | 'brevo'

export const MAIL_PROVIDERS: MailProvider[] = ['resend', 'brevo']

export type MailProviderRow = {
  provider: MailProvider
  plan: string | null
  daily_limit: number | null
  monthly_limit: number | null
  cycle_day: number
  used_today_offset: number
  used_cycle_offset: number
  offset_at: string | null
}

export type MailUsageRow = { provider: MailProvider; sent: number; sent_at: string }

export type MailQuota = {
  provider: MailProvider
  plan: string | null
  dailyLimit: number | null
  monthlyLimit: number | null
  cycleDay: number
  usedToday: number
  usedCycle: number
  cycleStart: Date
  /** Lower of what's left today and this cycle; null when neither has a limit. */
  remaining: number | null
}

/** Start of the current UTC day: when both providers' daily quotas start over. */
export function dayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

/** The last time the monthly quota started over: `cycleDay` of this month or the previous one. */
export function cycleStart(now: Date, cycleDay: number): Date {
  const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), cycleDay))
  return thisMonth <= now ? thisMonth : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, cycleDay))
}

// What the dashboard showed counts only if it was synced inside the window;
// after that, only the sends logged since the sync.
function usedSince(start: Date, offset: number, offsetAt: Date | null, usage: MailUsageRow[]): number {
  const synced = offsetAt && offsetAt >= start ? offsetAt : null
  const from = synced ?? start
  return (synced ? offset : 0) + usage.filter((u) => new Date(u.sent_at) >= from).reduce((n, u) => n + u.sent, 0)
}

export function computeQuota(row: MailProviderRow, usage: MailUsageRow[], now: Date): MailQuota {
  const offsetAt = row.offset_at ? new Date(row.offset_at) : null
  const mine = usage.filter((u) => u.provider === row.provider)
  const start = cycleStart(now, row.cycle_day)
  const usedToday = usedSince(dayStart(now), row.used_today_offset, offsetAt, mine)
  const usedCycle = usedSince(start, row.used_cycle_offset, offsetAt, mine)
  const left = [
    row.daily_limit === null ? null : row.daily_limit - usedToday,
    row.monthly_limit === null ? null : row.monthly_limit - usedCycle,
  ].filter((n): n is number => n !== null)
  return {
    provider: row.provider,
    plan: row.plan,
    dailyLimit: row.daily_limit,
    monthlyLimit: row.monthly_limit,
    cycleDay: row.cycle_day,
    usedToday,
    usedCycle,
    cycleStart: start,
    remaining: left.length ? Math.max(0, Math.min(...left)) : null,
  }
}

export async function loadMailQuotas(db: SupabaseClient, now = new Date()): Promise<MailQuota[]> {
  const { data: rows, error } = await db.from('mail_providers').select('provider, plan, daily_limit, monthly_limit, cycle_day, used_today_offset, used_cycle_offset, offset_at')
  if (error) throw new Error(`No se pudo leer los cupos de mail: ${error.message}`)
  const providers = (rows ?? []) as MailProviderRow[]
  if (providers.length === 0) return []
  // The oldest window that matters is the earliest cycle start.
  const since = new Date(Math.min(...providers.map((p) => cycleStart(now, p.cycle_day).getTime())))
  const { data: usage, error: usageError } = await db.from('mail_usage').select('provider, sent, sent_at').gte('sent_at', since.toISOString())
  if (usageError) throw new Error(`No se pudo leer el consumo de mail: ${usageError.message}`)
  return providers.map((p) => computeQuota(p, (usage ?? []) as MailUsageRow[], now))
}

/**
 * Splits `count` mails across providers in the order given, each taking what
 * it has left minus its reserve. A provider without a quota row or limits
 * takes everything still unassigned. What fits nowhere is `deferred`.
 */
export function splitAcrossProviders(
  count: number,
  order: { provider: MailProvider; quota: MailQuota | null; reserve: number }[],
): { take: Record<MailProvider, number>; deferred: number } {
  const take: Record<MailProvider, number> = { resend: 0, brevo: 0 }
  let left = count
  for (const { provider, quota, reserve } of order) {
    const available = !quota || quota.remaining === null ? left : Math.max(0, quota.remaining - reserve)
    take[provider] = Math.min(left, available)
    left -= take[provider]
  }
  return { take, deferred: left }
}

/**
 * Logs `sent` accepted mails against a provider's quota. Never throws: a
 * missed count only makes /admin/envios a little optimistic, and the next
 * sync from the dashboard corrects it.
 */
export async function recordMailUsage(provider: MailProvider, sent: number): Promise<void> {
  if (sent <= 0 || !isSupabaseConfigured) return
  try {
    const { error } = await createAdminClient().from('mail_usage').insert({ provider, sent })
    if (error) console.error('mail usage: failed to record', provider, sent, error.message)
  } catch (err) {
    console.error('mail usage: failed to record', provider, sent, err)
  }
}

/** Addresses a Resend payload goes to: to + cc + bcc. */
export function recipientCount(payload: { to: string | string[]; cc?: string | string[]; bcc?: string | string[] }): number {
  const n = (v: string | string[] | undefined) => (v === undefined ? 0 : Array.isArray(v) ? v.length : 1)
  return n(payload.to) + n(payload.cc) + n(payload.bcc)
}
