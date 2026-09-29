'use client'

import { useEffect } from 'react'
import { track } from '@/lib/track'
import { REFERRAL_COOKIE, REFERRAL_MAX_AGE, readReferralCookie, readReferralParam } from '@/lib/referral'

// Remembers which artist's link brought this visitor (lib/referral.ts), on
// whatever page they land. Mounted in app/layout.tsx ahead of the page so
// its effect runs before the gallery's (Game.tsx), which drops the query
// string from the address bar.
//
// First ref wins: the artist whose link introduced someone to the Mundial
// is the one who gets the credit, even if a friend's link brings them back
// later — otherwise every re-share would steal it. The cookie expires 30
// days after that first visit.
export function ReferralCapture() {
  useEffect(() => {
    try {
      const ref = readReferralParam(window.location.search)
      if (!ref) return
      if (!readReferralCookie(document.cookie)) {
        document.cookie = `${REFERRAL_COOKIE}=${ref}; path=/; max-age=${REFERRAL_MAX_AGE}; samesite=lax`
      }
      track('referral_open')
    } catch {}
  }, [])
  return null
}
