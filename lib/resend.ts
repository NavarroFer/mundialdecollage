import { Resend } from 'resend'
import { site } from '@/lib/site'

// Same pattern as isSupabaseConfigured: everything checks this first so the
// admin panel renders (in a disabled state) before real credentials exist.
export const isResendConfigured = Boolean(process.env.RESEND_API_KEY)

// Only call after checking isResendConfigured.
export function createResendClient() {
  return new Resend(process.env.RESEND_API_KEY!)
}

// Resend's batch endpoint caps out at 100 emails per call.
export const RESEND_BATCH_SIZE = 100

// Pulls "mundialdecollage.com.ar" out of site.mailFrom's "Name <user@domain>" form.
export function getMailFromDomain(): string | null {
  return site.mailFrom.match(/@([^>]+)>/)?.[1] ?? null
}

export type ResendDomainStatus = {
  domain: string
  found: boolean
  status?: string
  openTracking?: boolean
  clickTracking?: boolean
}

// Sends fail silently-looking (Resend accepts the API call but never
// delivers) until this domain is verified in Resend, and opens never get
// tracked until openTracking is on — both invisible from inside the app
// otherwise, so the "nueva campaña" page surfaces them directly.
export async function getDomainStatus(): Promise<ResendDomainStatus | null> {
  if (!isResendConfigured) return null
  const domainName = getMailFromDomain()
  if (!domainName) return null

  const resend = createResendClient()
  const { data, error } = await resend.domains.list()
  if (error || !data) return { domain: domainName, found: false }

  const domain = data.data.find((d) => d.name === domainName)
  if (!domain) return { domain: domainName, found: false }

  return {
    domain: domainName,
    found: true,
    status: domain.status,
    openTracking: domain.open_tracking,
    clickTracking: domain.click_tracking,
  }
}
