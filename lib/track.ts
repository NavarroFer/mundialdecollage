// Browser side of the circuit measurement (lib/funnel.ts). Steps queue up and
// leave together, a few seconds after the first one or as soon as the page
// is hidden or left, so a visit costs one /api/track call (one Function
// invocation) instead of one per step. Fire-and-forget: sendBeacon survives
// the page being left right after (e.g. the redirect to Google), and nothing
// here may ever break the page it's called from.
import { TRACK_BATCH_MAX, VISITOR_COOKIE, VISITOR_ID_PATTERN, type FunnelEvent } from '@/lib/funnel'

// Long enough to catch a page's opening steps (home_view, then the hero's
// CTA coming into view) in one call; short enough that a tab closed without
// a pagehide loses little.
const FLUSH_DELAY_MS = 5000

let queue: { name: FunnelEvent; vid: string }[] = []
let timer: ReturnType<typeof setTimeout> | undefined
let listening = false

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

function send(body: string) {
  if (navigator.sendBeacon?.('/api/track', new Blob([body], { type: 'application/json' }))) return
  void fetch('/api/track', { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } }).catch(() => {})
}

export function flushTracking() {
  try {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    while (queue.length) {
      // One call per visitor id; it only changes if the cookie was cleared mid-visit.
      const vid = queue[0].vid
      const batch = queue.slice(0, TRACK_BATCH_MAX).filter((entry) => entry.vid === vid)
      queue = queue.filter((entry) => !batch.includes(entry))
      send(JSON.stringify({ names: batch.map((entry) => entry.name), vid }))
    }
  } catch {}
}

function onHidden() {
  if (document.visibilityState === 'hidden') flushTracking()
}

export function track(name: FunnelEvent) {
  try {
    // Read (or set) right away: server actions attribute steps by this cookie.
    queue.push({ name, vid: visitorId() })
    if (!listening) {
      listening = true
      // pagehide: leaving or reloading; hidden: a phone switching apps, which may never come back.
      window.addEventListener('pagehide', flushTracking)
      document.addEventListener('visibilitychange', onHidden)
    }
    if (queue.length >= TRACK_BATCH_MAX) flushTracking()
    else timer ??= setTimeout(flushTracking, FLUSH_DELAY_MS)
  } catch {}
}
