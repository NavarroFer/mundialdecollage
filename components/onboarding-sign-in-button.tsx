'use client'

import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GoogleIcon, useGoogleSignIn } from '@/components/auth/google-sign-in-button'
import { useI18n } from '@/lib/i18n/client'
import { track } from '@/lib/track'

// The one thing to do on /onboarding's signed-out screen, so it's the full
// width primary button instead of the header's small outline one — and it
// records onboarding_signin_click (lib/funnel.ts) before leaving for Google.
export function OnboardingSignInButton() {
  const { m } = useI18n()
  const { loading, slow, start } = useGoogleSignIn('/onboarding', () => track('onboarding_signin_click'))

  return (
    <>
      <Button size="lg" onClick={() => void start()} disabled={loading} aria-busy={loading} className="h-auto min-h-14 w-full gap-3 px-4 py-3">
        {loading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <span className="flex size-7 items-center justify-center rounded-full bg-white">
            <GoogleIcon />
          </span>
        )}
        {loading ? m.auth.signingIn : m.auth.signIn}
      </Button>
      {slow && <p role="status" className="mt-3 rounded-lg bg-collage-yellow/20 px-3 py-2 text-sm font-medium text-ink">{m.auth.slowSignIn}</p>}
    </>
  )
}
