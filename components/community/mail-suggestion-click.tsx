'use client'

import { useEffect } from 'react'
import { track } from '@/lib/track'

// The daily mail links its suggestions with ?sugerida=mail. Read in the browser
// (not from searchParams) so the obra page stays static for everyone else.
export function MailSuggestionClick() {
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get('sugerida') === 'mail') track('community_suggestion_click')
    } catch { /* no location: nothing to measure */ }
  }, [])
  return null
}
