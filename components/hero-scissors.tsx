'use client'

import { useEffect, useRef, useState } from 'react'
import { Scissors } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { dropPageFabric, FABRIC_TOTAL_MS } from '@/lib/paper-fabric'

// The cut is deliberately a small interruption: the scissors sweep across,
// the page below the cut drops like cloth and piles up at the bottom of the
// screen, then is lifted back into place (lib/paper-fabric.ts).
export function HeroScissors() {
  const { m } = useI18n()
  const [cutting, setCutting] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const undoRef = useRef<(() => void) | null>(null)

  // Navigating away mid-cut mustn't leave the cloth hanging over the next page.
  useEffect(() => () => undoRef.current?.(), [])

  function cutPage() {
    if (cutting) return
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    setCutting(true)
    const siteContent = document.getElementById('site-content')
    const cutY = rect.top + rect.height / 2
    siteContent?.style.setProperty('--paper-cut-y', `${cutY}px`)
    siteContent?.classList.add('paper-cut-active')
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) undoRef.current = dropPageFabric(cutY)
    window.setTimeout(() => {
      undoRef.current?.()
      undoRef.current = null
      siteContent?.classList.remove('paper-cut-active')
      siteContent?.style.removeProperty('--paper-cut-y')
      setCutting(false)
    }, FABRIC_TOTAL_MS)
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
