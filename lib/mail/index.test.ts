import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mail, TransportResult } from './transports'
import { assignProviders, routesFor, sendMail, sendMails } from './index'
import { computeQuota } from '@/lib/mail-quota'

const { sent, behaviour, recorded } = vi.hoisted(() => ({
  sent: { resend: [], brevo: [] } as Record<string, Mail[]>,
  behaviour: {} as Record<string, (mail: Mail) => TransportResult>,
  recorded: [] as [string, number][],
}))

vi.mock('./transports', () => {
  const transport = (provider: 'resend' | 'brevo') => ({
    provider,
    configured: true,
    send: async (mails: Mail[]) => mails.map((mail) => {
      sent[provider].push(mail)
      return behaviour[provider](mail)
    }),
  })
  return { resendTransport: transport('resend'), brevoTransport: transport('brevo') }
})
vi.mock('@/lib/supabase/config', () => ({ isSupabaseConfigured: false }))
vi.mock('@/lib/mail-quota', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/mail-quota')>()),
  recordMailUsage: async (provider: string, n: number) => { if (n) recorded.push([provider, n]) },
}))

const ok = (): TransportResult => ({ ok: true, id: 'id' })
const outOfQuota = (): TransportResult => ({ ok: false, error: 'daily quota', quota: true })
const mail = (to: string): Mail => ({ to, subject: 's', html: '<p>hi</p>' })

beforeEach(() => {
  sent.resend = []
  sent.brevo = []
  recorded.length = 0
  behaviour.resend = ok
  behaviour.brevo = ok
})

describe('routesFor', () => {
  it('sends transactional mail through Resend first and bulk through Brevo first', () => {
    expect(routesFor('transactional', () => true).map((r) => r.provider)).toEqual(['resend', 'brevo'])
    expect(routesFor('bulk', () => true).map((r) => [r.provider, r.reserve])).toEqual([['brevo', 0], ['resend', 20]])
    expect(routesFor('bulk', (p) => p === 'resend').map((r) => r.provider)).toEqual(['resend'])
  })
})

describe('assignProviders', () => {
  it('splits by what each has left and sends the overflow to the first one anyway', () => {
    const quota = (remaining: number) => ({
      ...computeQuota({ provider: 'brevo', plan: null, daily_limit: null, monthly_limit: null, cycle_day: 1, used_today_offset: 0, used_cycle_offset: 0, offset_at: null }, [], new Date()),
      remaining,
    })
    const quotas = new Map([['brevo', quota(2)], ['resend', quota(21)]] as const)
    expect(assignProviders(5, routesFor('bulk', () => true), new Map(quotas))).toEqual(['brevo', 'brevo', 'resend', 'brevo', 'brevo'])
  })
})

describe('sendMails', () => {
  it('sends transactional mail through Resend and records the usage', async () => {
    const result = await sendMail(mail('a@x.com'))
    expect(result).toEqual({ ok: true, provider: 'resend', id: 'id' })
    expect(sent.brevo).toEqual([])
    expect(recorded).toEqual([['resend', 1]])
  })

  it('moves the mails a provider rejects for quota to the next one', async () => {
    behaviour.brevo = outOfQuota
    const results = await sendMails([mail('a@x.com'), mail('b@x.com')], { kind: 'bulk' })
    expect(results.map((r) => r.ok && r.provider)).toEqual(['resend', 'resend'])
    expect(recorded).toEqual([['resend', 2]])
  })

  it('reports the error when every provider is out, and keeps other errors where they happened', async () => {
    behaviour.resend = outOfQuota
    behaviour.brevo = (m) => (m.to === 'bad@x.com' ? { ok: false, error: 'invalid', quota: false } : outOfQuota())
    const results = await sendMails([mail('bad@x.com'), mail('a@x.com')], { kind: 'transactional' })
    expect(results).toEqual([{ ok: false, error: 'invalid' }, { ok: false, error: 'daily quota' }])
  })
})
