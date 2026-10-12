// Where a visitor first came from, so each sign-up can be counted by origin
// in /admin/estadisticas (signup_source_* in lib/funnel.ts). Decided on the
// first page they open (lib/track.ts) and kept for 30 days in a cookie the
// sign-up's server action reads. First touch, not last: the link that
// brought someone is what deserves the credit, not the tab they came back in.
import { inAppBrowser } from '@/lib/in-app-browser'

export const VISIT_SOURCES = ['instagram', 'facebook', 'artist', 'google', 'email', 'direct', 'other'] as const
export type VisitSource = (typeof VISIT_SOURCES)[number]

export const VISIT_SOURCE_COOKIE = 'mdc-src'

export function isVisitSource(value: unknown): value is VisitSource {
  return typeof value === 'string' && (VISIT_SOURCES as readonly string[]).includes(value)
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

export function visitSource({ url, referrer, userAgent, referralCookie = false }: {
  url: string
  referrer: string
  userAgent: string
  // The artist's invitation (lib/referral.ts) is already in a cookie.
  referralCookie?: boolean
}): VisitSource {
  let params: URLSearchParams
  try {
    params = new URL(url).searchParams
  } catch {
    params = new URLSearchParams()
  }
  if (params.get('ref') || referralCookie) return 'artist'
  const utmSource = (params.get('utm_source') ?? '').toLowerCase()
  const utmMedium = (params.get('utm_medium') ?? '').toLowerCase()
  if (params.get('desde') === 'mail' || utmMedium === 'email' || ['email', 'mail', 'newsletter'].includes(utmSource)) return 'email'

  const app = inAppBrowser(userAgent)
  if (app) return app
  if (utmSource.includes('instagram') || utmSource === 'ig') return 'instagram'
  if (utmSource.includes('facebook') || utmSource === 'fb') return 'facebook'

  const host = hostOf(referrer)
  const own = hostOf(url)
  if (!host || host === own) return 'direct'
  if (/(^|\.)instagram\.com$/.test(host)) return 'instagram'
  if (/(^|\.)(facebook\.com|fb\.com|messenger\.com)$/.test(host)) return 'facebook'
  if (/^mail\.google\.|(^|\.)outlook\.(com|live\.com)$|^mail\.yahoo\.|^webmail\./.test(host)) return 'email'
  if (/(^|\.)google\.[a-z.]+$/.test(host)) return 'google'
  return 'other'
}
