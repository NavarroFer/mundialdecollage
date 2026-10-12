'use client'

import { useState, useSyncExternalStore } from 'react'
import { Copy, ExternalLink } from 'lucide-react'
import { inAppBrowser } from '@/lib/in-app-browser'
import { useI18n } from '@/lib/i18n/client'

const noSubscription = () => () => {}

// Above /onboarding when it's open inside Instagram's or Facebook's browser,
// where the file picker and Google sign-in fail the most: how to move to a
// real browser, and the link to paste there. Read from the user agent on the
// client only, so the server render stays the same for everyone.
export function InAppBrowserNotice({ className }: { className?: string }) {
  const app = useSyncExternalStore(noSubscription, () => inAppBrowser(navigator.userAgent), () => null)
  const { m } = useI18n()
  const t = m.onboarding.inApp
  // The clipboard is often blocked in these browsers: then the link is shown
  // selected, ready for a long press.
  const [copy, setCopy] = useState<'idle' | 'done' | 'manual'>('idle')
  if (!app) return null

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopy('done')
    } catch {
      setCopy('manual')
    }
  }

  return (
    <div role="note" className={`rounded-2xl border-2 border-collage-red/40 bg-card p-4 text-left ${className ?? ''}`}>
      <p className="flex items-start gap-2 font-semibold text-ink">
        <ExternalLink className="mt-0.5 size-4 shrink-0 text-collage-red" aria-hidden="true" />
        {t.title}
      </p>
      <p className="mt-1.5 text-sm text-muted-foreground">{t.steps}</p>
      <button
        type="button"
        onClick={() => void copyLink()}
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-ink/15 px-4 text-sm font-semibold text-ink hover:border-ink/40"
      >
        <Copy className="size-4" aria-hidden="true" />
        {t.copy}
      </button>
      {copy === 'done' && <p role="status" className="mt-2 text-sm font-semibold text-collage-blue">{t.copied}</p>}
      {copy === 'manual' && (
        <input
          readOnly
          value={typeof window === 'undefined' ? '' : window.location.href}
          onFocus={(event) => event.currentTarget.select()}
          autoFocus
          aria-label={t.copy}
          className="mt-2 w-full rounded-lg border-2 border-ink/15 bg-background px-3 py-2 text-sm"
        />
      )}
    </div>
  )
}
