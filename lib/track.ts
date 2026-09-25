// Browser side of the circuit measurement (lib/funnel.ts). Fire-and-forget:
// sendBeacon survives the page being left right after (e.g. the redirect to
// Google), and nothing here may ever break the page it's called from.
import { VISITOR_COOKIE, VISITOR_ID_PATTERN, type FunnelEvent } from '@/lib/funnel'

function visitorId(): string {
  const existing = document.cookie.split('; ').find((part) => part.startsWith(`${VISITOR_COOKIE}=`))?.split('=')[1]
  if (existing && VISITOR_ID_PATTERN.test(existing)) return existing
  const id = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  // A cookie (not localStorage) so server actions can attribute steps too.
  document.cookie = `${VISITOR_COOKIE}=${id}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
  return id
}

export function track(name: FunnelEvent) {
  try {
    const body = JSON.stringify({ name, vid: visitorId() })
    if (navigator.sendBeacon?.('/api/track', new Blob([body], { type: 'application/json' }))) return
    void fetch('/api/track', { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } }).catch(() => {})
  } catch {}
}
