'use client'

import { useActionState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { joinWaitlist, type WaitlistState } from '@/app/aviso/actions'
import type { WaitlistSource } from '@/lib/waitlist'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'

// «Avisame» for visitors who aren't artists: the finalists, the magazine and
// the Mundial's news by email (app/aviso/actions.ts).
// title/body replace the default «Enterate de las finalistas» wording where
// the page asks for something more specific (the magazine's pre-sale).
export function WaitlistSignup({ source, className, title, body }: { source: WaitlistSource; className?: string; title?: string; body?: string }) {
  const { m } = useI18n()
  const t = m.growth
  const [state, action, pending] = useActionState<WaitlistState, FormData>(joinWaitlist.bind(null, source), 'idle')

  if (state === 'done') {
    return (
      <p role="status" className={cn('flex items-center justify-center gap-2 text-sm font-semibold text-collage-blue', className)}>
        <CheckCircle2 className="size-4" aria-hidden="true" />
        {t.waitlistDone}
      </p>
    )
  }

  return (
    <form action={action} className={cn('w-full max-w-md', className)}>
      <p className="font-display text-xl tracking-tight text-ink uppercase">{title ?? t.waitlistTitle}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body ?? t.waitlistBody}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor={`waitlist-${source}`}>{t.waitlistEmail}</label>
        <input
          id={`waitlist-${source}`}
          name="email"
          type="email"
          required
          autoComplete="email"
          maxLength={254}
          placeholder={t.waitlistEmail}
          className="min-h-11 w-full rounded-lg border-2 border-ink/15 bg-background px-4 py-2 text-sm"
        />
        {/* Honeypot — see joinWaitlist. */}
        <input name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
        <Button type="submit" disabled={pending} className="min-h-11 shrink-0">
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {t.waitlistSubmit}
        </Button>
      </div>
      {state !== 'idle' && <p role="alert" className="mt-2 text-sm text-collage-red">{t.waitlistErrors[state]}</p>}
      <p className="mt-2 text-xs text-muted-foreground/80">{t.waitlistPrivacy}</p>
    </form>
  )
}

// One tap for someone already signed in with Google (the gallery, right
// after a like or comment): their account's email is used.
export function WaitlistOneClick({ className }: { className?: string }) {
  const { m } = useI18n()
  const t = m.growth
  const [state, action, pending] = useActionState<WaitlistState, FormData>(joinWaitlist.bind(null, 'galeria'), 'idle')

  if (state === 'done') return <p role="status" className={cn('text-sm font-semibold', className)}>{t.waitlistDone}</p>
  return (
    <form action={action} className={className}>
      <button type="submit" disabled={pending} className="text-left text-sm font-semibold underline underline-offset-4 disabled:opacity-60">
        {t.waitlistOneClick}
      </button>
      {state !== 'idle' && <p role="alert" className="mt-1 text-sm text-collage-red">{t.waitlistErrors[state]}</p>}
    </form>
  )
}
