'use client'

import { useEffect } from 'react'

/** Ensures standalone pages never inherit the scroll position of the previous route. */
export function ScrollToTop() {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [])

  return null
}
