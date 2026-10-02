// The one way the app sends mail: callers say what to send and whether it's
// transactional or bulk; this picks the provider (lib/mail/transports.ts)
// with the quota left for it (lib/mail-quota.ts), falls over to the other
// one when a provider runs out mid-send, and logs what each one took.
//
//   transactional (receipts, jury, admin notices): Resend first, Brevo when
//     Resend is out. Never held back.
//   bulk (certificates, welcomes, campaigns): Brevo first, then Resend minus
//     RESEND_RESERVE, so a big send can't leave no room for a receipt.
//
// Server-only: reads and logs the quotas with the service role.
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { loadMailQuotas, recipientCount, recordMailUsage, splitAcrossProviders, type MailProvider, type MailQuota } from '@/lib/mail-quota'
import { brevoTransport, resendTransport, type Mail, type MailTransport } from '@/lib/mail/transports'

export type { Mail } from '@/lib/mail/transports'

export type MailKind = 'transactional' | 'bulk'

export type MailResult =
  | { ok: true; provider: MailProvider; id: string | null }
  | { ok: false; error: string }

/** Resend mails per day kept for transactional mail when sending in bulk. */
export const RESEND_RESERVE = 20

const TRANSPORTS: Record<MailProvider, MailTransport> = { resend: resendTransport, brevo: brevoTransport }

export const isMailConfigured = resendTransport.configured || brevoTransport.configured

export type Route = { provider: MailProvider; reserve: number }

/** The providers to try for a kind of mail, in order, with what each keeps back. */
export function routesFor(kind: MailKind, configured: (p: MailProvider) => boolean): Route[] {
  const routes: Route[] = kind === 'bulk'
    ? [{ provider: 'brevo', reserve: 0 }, { provider: 'resend', reserve: RESEND_RESERVE }]
    : [{ provider: 'resend', reserve: 0 }, { provider: 'brevo', reserve: 0 }]
  return routes.filter((r) => configured(r.provider))
}

/**
 * Which provider each of `count` mails goes to first: each provider takes
 * what its quota has left, in order. What fits nowhere still goes to the
 * first one — the counter can be off, and the provider gets the last word.
 */
export function assignProviders(count: number, routes: Route[], quotas: Map<MailProvider, MailQuota>): MailProvider[] {
  if (routes.length === 0) return []
  const { take } = splitAcrossProviders(count, routes.map((r) => ({ ...r, quota: quotas.get(r.provider) ?? null })))
  const assigned = routes.flatMap((r) => Array<MailProvider>(take[r.provider]).fill(r.provider))
  return [...assigned, ...Array<MailProvider>(count - assigned.length).fill(routes[0].provider)]
}

async function quotasByProvider(): Promise<Map<MailProvider, MailQuota>> {
  if (!isSupabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return new Map()
  try {
    return new Map((await loadMailQuotas(createAdminClient())).map((q) => [q.provider, q]))
  } catch (err) {
    // Without the counters, send anyway: the providers still enforce theirs.
    console.error('mail: quotas unavailable', err)
    return new Map()
  }
}

/**
 * How many bulk mails fit right now across both providers (after the Resend
 * reserve), for senders that can leave the rest for another day. null when
 * nothing is limited.
 */
export async function bulkCapacity(): Promise<number | null> {
  const quotas = await quotasByProvider()
  let total = 0
  for (const { provider, reserve } of routesFor('bulk', (p) => TRANSPORTS[p].configured)) {
    const remaining = quotas.get(provider)?.remaining ?? null
    if (remaining === null) return null
    total += Math.max(0, remaining - reserve)
  }
  return total
}

/** Sends mails, each through the provider picked for it. Results come back in the same order. */
export async function sendMails(mails: Mail[], { kind }: { kind: MailKind }): Promise<MailResult[]> {
  const results: MailResult[] = mails.map(() => ({ ok: false, error: 'No hay ningún proveedor de mail configurado' }))
  const routes = routesFor(kind, (p) => TRANSPORTS[p].configured)
  if (mails.length === 0 || routes.length === 0) return results

  const assigned = assignProviders(mails.length, routes, await quotasByProvider())
  const exhausted = new Set<MailProvider>()
  // Each round sends every pending mail through its provider; the ones it
  // rejects for quota move on to the next provider still standing.
  let pending = mails.map((_, i) => i)
  while (pending.length) {
    const byProvider = new Map<MailProvider, number[]>()
    for (const i of pending) byProvider.set(assigned[i], [...(byProvider.get(assigned[i]) ?? []), i])
    pending = []
    for (const [provider, indexes] of byProvider) {
      const sent = await TRANSPORTS[provider].send(indexes.map((i) => mails[i]))
      let accepted = 0
      for (const [k, result] of sent.entries()) {
        const i = indexes[k]
        if (result.ok) {
          results[i] = { ok: true, provider, id: result.id }
          accepted += recipientCount(mails[i])
          continue
        }
        results[i] = { ok: false, error: result.error }
        if (!result.quota) continue
        exhausted.add(provider)
        const next = routes.find((r) => !exhausted.has(r.provider) && r.provider !== provider)
        if (next) { assigned[i] = next.provider; pending.push(i) }
      }
      await recordMailUsage(provider, accepted)
    }
  }
  return results
}

/** Sends one mail (transactional unless said otherwise). */
export async function sendMail(mail: Mail, { kind = 'transactional' }: { kind?: MailKind } = {}): Promise<MailResult> {
  return (await sendMails([mail], { kind }))[0]
}
