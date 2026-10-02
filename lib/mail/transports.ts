// The mail providers, behind one interface so lib/mail picks one per mail at
// send time (strategy pattern): Resend and Brevo both take a list of mails and
// answer, mail by mail, with the provider's id or why it was rejected.
import { createResendClient, isResendConfigured, RESEND_BATCH_SIZE } from '@/lib/resend'
import { site } from '@/lib/site'
import type { MailProvider } from '@/lib/mail-quota'

export type Mail = {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  replyTo?: string
}

export type TransportResult =
  | { ok: true; id: string | null }
  // `quota`: the provider is out of quota (or credits) for now, so the
  // router stops using it and tries the next one.
  | { ok: false; error: string; quota: boolean }

export interface MailTransport {
  provider: MailProvider
  configured: boolean
  send(mails: Mail[]): Promise<TransportResult[]>
}

// Resend allows a couple of API calls per second by default; a short pause
// between batches keeps a big send from tripping it.
const RESEND_BATCH_PAUSE_MS = 600
const RESEND_QUOTA_ERRORS = new Set(['daily_quota_exceeded', 'monthly_quota_exceeded'])

export const resendTransport: MailTransport = {
  provider: 'resend',
  configured: isResendConfigured,
  async send(mails) {
    const results: TransportResult[] = []
    for (let i = 0; i < mails.length; i += RESEND_BATCH_SIZE) {
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, RESEND_BATCH_PAUSE_MS))
      const batch = mails.slice(i, i + RESEND_BATCH_SIZE)
      // Resend's SDK resolves to { data, error } instead of throwing; guard
      // anyway so a network error fails the batch instead of the whole send.
      const { data, error } = await createResendClient().batch.send(batch.map((mail) => ({ from: site.mailFrom, ...mail }) as Parameters<ReturnType<typeof createResendClient>['batch']['send']>[0][number]))
        .catch((err: unknown) => ({ data: null, error: { message: err instanceof Error ? err.message : String(err), name: 'network_error' } }))
      if (error || !data) {
        const failure = { ok: false as const, error: error?.message ?? 'Error desconocido', quota: RESEND_QUOTA_ERRORS.has(error?.name ?? '') }
        results.push(...batch.map(() => failure))
      } else {
        results.push(...batch.map((_, j) => ({ ok: true as const, id: data.data[j]?.id ?? null })))
      }
    }
    return results
  },
}

type BrevoResponse = { messageId?: string; code?: string; message?: string }

// "Name <user@domain>" → the parts Brevo's API wants.
function brevoSender() {
  const match = site.mailFrom.match(/^\s*(.*?)\s*<([^>]+)>\s*$/)
  return match ? { name: match[1] || 'Mundial de Collage', email: match[2] } : { name: 'Mundial de Collage', email: site.email }
}

// Brevo answers 402 when the account runs out of credits (the free plan's
// daily 300); quota-ish wording is caught too, since its codes vary.
function isBrevoQuotaError(status: number, body: BrevoResponse) {
  return status === 402 || /credit|quota|limit/i.test(`${body.code ?? ''} ${body.message ?? ''}`)
}

export const brevoTransport: MailTransport = {
  provider: 'brevo',
  configured: Boolean(process.env.BREVO_API_KEY),
  async send(mails) {
    const apiKey = process.env.BREVO_API_KEY
    const results: TransportResult[] = []
    let outOfQuota: string | null = null
    // One call per mail: each one is personalised. Once Brevo says it's out
    // of quota, the rest fail the same way without calling it.
    for (const mail of mails) {
      if (!apiKey) { results.push({ ok: false, error: 'BREVO_API_KEY no está configurada', quota: false }); continue }
      if (outOfQuota) { results.push({ ok: false, error: outOfQuota, quota: true }); continue }
      try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({
            sender: brevoSender(),
            to: (Array.isArray(mail.to) ? mail.to : [mail.to]).map((email) => ({ email })),
            subject: mail.subject,
            ...(mail.html ? { htmlContent: mail.html } : {}),
            ...(mail.text ? { textContent: mail.text } : {}),
            ...(mail.replyTo ? { replyTo: { email: mail.replyTo } } : {}),
          }),
        })
        const body = (await response.json().catch(() => ({}))) as BrevoResponse
        if (response.ok) { results.push({ ok: true, id: body.messageId ?? null }); continue }
        const error = body.message ?? `Brevo respondió ${response.status}`
        const quota = isBrevoQuotaError(response.status, body)
        if (quota) outOfQuota = error
        results.push({ ok: false, error, quota })
      } catch (err) {
        results.push({ ok: false, error: err instanceof Error ? err.message : 'No se pudo conectar con Brevo', quota: false })
      }
    }
    return results
  },
}
