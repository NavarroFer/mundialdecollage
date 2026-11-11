'use client'

import { useState } from 'react'
import { startGoogleSignIn } from '@/components/auth/google-sign-in-button'
import { Button } from '@/components/ui/button'

// Static in the anonymous HTML. The click reads the address bar so Google
// brings the visitor back to this page, not to a fixed path.
export function SignInButton({ label, pendingLabel, className }: { label: string; pendingLabel: string; className?: string }) {
  const [loading, setLoading] = useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      disabled={loading}
      className={className ?? 'h-11 px-4 text-sm'}
      onClick={() => {
        const next = `${window.location.pathname}${window.location.search}${window.location.hash}`
        setLoading(true)
        void startGoogleSignIn(next || '/').then(({ error }) => {
          if (error) setLoading(false)
        })
      }}
    >
      {loading ? pendingLabel : label}
    </Button>
  )
}
