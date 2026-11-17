'use client'

import { Children, useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { fmt } from '@/lib/i18n/format'
import { cn } from '@/lib/utils'

type Labels = { label: string; prev: string; next: string; goTo: string }

/**
 * The swipe row under components/offer-banners.tsx. The browser does the
 * sliding (CSS scroll snap), so a finger, a trackpad and the keyboard all
 * work without a library; this only follows which slide is in view, for the
 * dots, and moves one slide at a time from the buttons. Each slide is a bit
 * narrower than the row, so the next one peeks in and says «swipe». It never
 * turns by itself: a visitor reads a banner at their own pace. `wide`: from
 * a laptop up every banner fits side by side, so the row stops sliding and
 * drops its controls (the public home, which is wider than the feed).
 */
export function OfferBannersRail({ children, labels, wide = false, className }: { children: React.ReactNode; labels: Labels; wide?: boolean; className?: string }) {
  const rail = useRef<HTMLUListElement>(null)
  const [active, setActive] = useState(0)
  const count = Children.count(children)

  const offsets = useCallback(() => {
    const slides = Array.from(rail.current?.children ?? []) as HTMLElement[]
    const first = slides[0]?.offsetLeft ?? 0
    return slides.map((slide) => slide.offsetLeft - first)
  }, [])

  useEffect(() => {
    const el = rail.current
    if (!el) return
    let frame = 0
    const follow = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const stops = offsets()
        // The last slide can't reach the row's start: at the end, it's the one in view.
        if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 2) return setActive(stops.length - 1)
        let nearest = 0
        stops.forEach((stop, i) => { if (Math.abs(stop - el.scrollLeft) < Math.abs(stops[nearest] - el.scrollLeft)) nearest = i })
        setActive(nearest)
      })
    }
    el.addEventListener('scroll', follow, { passive: true })
    return () => {
      el.removeEventListener('scroll', follow)
      cancelAnimationFrame(frame)
    }
  }, [offsets])

  const show = (index: number) => {
    const el = rail.current
    if (!el) return
    const target = Math.max(0, Math.min(count - 1, index))
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: offsets()[target] ?? 0, behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <section aria-label={labels.label} className={className}>
      {/* Bleeds to the screen edges on a phone (the column has 1rem of
          padding), so the next slide peeks in from the very edge. Wider, the
          column sits in the middle of the page and its edges fade out instead
          of cutting the next sheet with a straight line. The vertical padding
          leaves room for the tilted sheets and their shadow. */}
      <ul
        ref={rail}
        className={cn(
          '-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pt-1.5 pb-6 [scrollbar-width:none] sm:[mask-image:linear-gradient(to_right,transparent,#000_1rem,#000_calc(100%-3.5rem),transparent)] [&::-webkit-scrollbar]:hidden',
          wide && 'lg:mx-0 lg:snap-none lg:gap-6 lg:overflow-visible lg:px-0 lg:[mask-image:none]',
        )}
      >
        {children}
      </ul>
      {count > 1 && (
        <div className={cn('-mt-3 flex items-center justify-between gap-4', wide && 'lg:hidden')}>
          <div className="-ml-1.5 flex items-center">
            {Array.from({ length: count }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => show(i)}
                aria-label={fmt(labels.goTo, { n: i + 1, total: count })}
                aria-current={active === i ? 'true' : undefined}
                className="group/dot grid size-6 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-collage-blue"
              >
                <span
                  className={cn(
                    'block h-1.5 rounded-full transition-[width,background-color] duration-300 ease-out motion-reduce:transition-none',
                    active === i ? 'w-5 bg-ink' : 'w-1.5 bg-ink/25 group-hover/dot:bg-ink/50',
                  )}
                />
              </button>
            ))}
          </div>
          {/* A phone swipes; the arrows are for a mouse. */}
          <div className="hidden items-center gap-2 sm:flex">
            {([
              [labels.prev, ArrowLeft, active - 1, active === 0],
              [labels.next, ArrowRight, active + 1, active === count - 1],
            ] as const).map(([label, Icon, target, disabled]) => (
              <button
                key={label}
                type="button"
                onClick={() => show(target)}
                disabled={disabled}
                aria-label={label}
                className="grid size-10 place-items-center rounded-full border-2 border-ink/15 text-ink transition-colors hover:border-ink hover:bg-ink hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue disabled:pointer-events-none disabled:opacity-35"
              >
                <Icon className="size-4" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
