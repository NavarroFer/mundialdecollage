'use client'

import { useI18n } from '@/lib/i18n/client'

// First stop for keyboard users: jumps past the header to the page's <main>.
// Pages don't share a layout that owns <main>, so the target is looked up on
// click instead of hard-coding an id in every page.
export function SkipLink() {
  const { m } = useI18n()
  return (
    <a
      href="#"
      onClick={(event) => {
        const main = document.querySelector('main')
        if (!main) return
        event.preventDefault()
        main.setAttribute('tabindex', '-1')
        main.focus()
        main.scrollIntoView()
      }}
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-full focus:border-2 focus:border-ink focus:bg-paper focus:px-5 focus:py-3 focus:text-sm focus:font-bold focus:text-ink"
    >
      {m.common.skipToContent}
    </a>
  )
}
