'use client'

import { useRef, useState } from 'react'
import { Scissors } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'

// The cut is deliberately a small interruption: the rest of the page drops
// out of frame and stays there long enough for the gesture to register.
const CUT_DURATION_MS = 3000

export function HeroScissors() {
  const { m } = useI18n()
  const [cutting, setCutting] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  function cutPage() {
    if (cutting) return
    setCutting(true)
    const siteContent = document.getElementById('site-content')
    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect) siteContent?.style.setProperty('--paper-cut-y', `${rect.top + rect.height / 2}px`)
    siteContent?.classList.add('paper-cut-active')
    window.setTimeout(() => {
      siteContent?.classList.remove('paper-cut-active')
      siteContent?.style.removeProperty('--paper-cut-y')
      setCutting(false)
    }, CUT_DURATION_MS)
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={cutPage}
        disabled={cutting}
        aria-label={m.hero.scissorsLabel}
        className="animate-float-slow absolute right-[10%] bottom-24 z-20 rounded-full p-3 text-ink/30 transition hover:scale-110 hover:text-collage-red focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-collage-blue disabled:cursor-wait sm:bottom-24"
      >
        <Scissors className="size-10 sm:size-14" strokeWidth={1.5} aria-hidden="true" />
      </button>
      {cutting && (
        <div className="paper-cut-sweep" aria-hidden="true">
          <span className="paper-cut-line" />
          <Scissors className="paper-cut-scissors" strokeWidth={1.5} />
        </div>
      )}
    </>
  )
}
