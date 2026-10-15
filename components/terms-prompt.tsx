'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { TermsCheckbox } from '@/components/terms-checkbox'
import { useI18n } from '@/lib/i18n/client'
import { createClient } from '@/lib/supabase/client'
import { hasAcceptedCurrentTerms, recordTermsAcceptance } from '@/lib/terms-acceptance'
import { TERMS_VERSION } from '@/lib/terms-version'

// «Ahora no» puts the prompt off until the next visit, not for good.
const SNOOZE_MS = 12 * 60 * 60 * 1000
// Pages where it would cover what the person is reading to decide.
const READING_PAGES = /^(\/[a-z]{2})?\/(terminos-y-condiciones|politica-de-privacidad)\/?$/

// localStorage, per person and version: 'accepted', or until when it's put off.
const storageKey = (userId: string) => `terms-prompt:${TERMS_VERSION}:${userId}`
function stored(userId: string) {
  try { return window.localStorage.getItem(storageKey(userId)) } catch { return null }
}
function store(userId: string, value: string) {
  try { window.localStorage.setItem(storageKey(userId), value) } catch {}
}

// The Términos y Condiciones for signed-in people who haven't accepted the
// current version (TERMS_VERSION): people who signed up before they existed,
// or to like an obra. Asked of Supabase from the browser, once per visit at
// most, so the server render does no extra work; once accepted, this browser
// remembers it and stops asking.
export function TermsPrompt({ userId }: { userId: string }) {
  const { m } = useI18n()
  const t = m.terms
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (READING_PAGES.test(window.location.pathname)) return
    const previous = stored(userId)
    if (previous === 'accepted' || Number(previous) > Date.now()) return
    let cancelled = false
    hasAcceptedCurrentTerms(createClient(), userId)
      .then((accepted) => {
        if (cancelled) return
        if (accepted) store(userId, 'accepted')
        else setOpen(true)
      })
      // Unknown: better not to ask than to ask someone who already accepted.
      .catch(() => {})
    return () => { cancelled = true }
  }, [userId])

  function putOff() {
    store(userId, String(Date.now() + SNOOZE_MS))
    setOpen(false)
  }

  async function accept(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setFailed(false)
    const saved = await recordTermsAcceptance(createClient(), userId)
    setSaving(false)
    if (!saved) { setFailed(true); return }
    store(userId, 'accepted')
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !saving) putOff() }}>
      <DialogContent aria-describedby="terms-prompt-body" className="max-h-[92dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto p-6">
        <DialogTitle className="font-display pr-8 text-2xl tracking-wide uppercase">{t.promptTitle}</DialogTitle>
        <p id="terms-prompt-body" className="mt-3 text-sm text-muted-foreground">{t.promptBody}</p>
        <form onSubmit={(event) => void accept(event)} className="mt-5 space-y-4">
          <TermsCheckbox id="accept_terms_prompt" />
          {failed && <p role="alert" className="text-sm text-collage-red">{t.promptFailed}</p>}
          <Button type="submit" size="lg" disabled={saving} className="min-h-12 w-full">
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {t.promptAccept}
          </Button>
          <button type="button" disabled={saving} onClick={putOff} className="min-h-11 w-full text-center text-sm underline underline-offset-4 disabled:opacity-50">
            {t.promptLater}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
