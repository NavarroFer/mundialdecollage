'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GoogleIcon, startGoogleSignIn } from '@/components/auth/google-sign-in-button'
import { useI18n } from '@/lib/i18n/client'
import { track } from '@/lib/track'

// The one thing to do on /onboarding's signed-out screen, so it's the full
// width primary button instead of the header's small outline one — and it
// records onboarding_signin_click (lib/funnel.ts) before leaving for Google.
export function OnboardingSignInButton() {
  const [loading, setLoading] = useState(false)
  const { m } = useI18n()

  async function handleClick() {
    track('onboarding_signin_click')
    setLoading(true)
    await startGoogleSignIn('/onboarding')
  }

  return (
    <Button size="lg" onClick={handleClick} disabled={loading} className="h-auto min-h-14 w-full gap-3 px-4 py-3">
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <span className="flex size-7 items-center justify-center rounded-full bg-white">
          <GoogleIcon />
        </span>
      )}
      {loading ? m.auth.signingIn : m.auth.signIn}
    </Button>
  )
}
