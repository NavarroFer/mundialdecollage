'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import type { ArtworkSummary } from '@/lib/finalists'
import { CountryFlag } from '@/components/country-flag'
import { ObraLink } from '@/components/obra-modal'
import { useI18n } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/format'
import './obras-collage.css'
import { imageSrc } from '@/lib/image-src'

export function ObrasCollage({
  finalists,
  flags = {},
  animateEntrance = false,
  scrollDriven = false,
  showHint = true,
  ariaLabel,
}: {
  finalists: ArtworkSummary[]
  // SVG flags by upper-case country code, from lib/flag-svg.ts.
  flags?: Record<string, string>
  animateEntrance?: boolean
  // Lets the visitor's vertical scroll gently recompose this existing stack.
  // It is intentionally subtle on desktop and more pronounced on phones.
  scrollDriven?: boolean
  showHint?: boolean
  ariaLabel?: string
}) {
  const { m } = useI18n()
  const rootRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLLIElement | null>>([])

  useEffect(() => {
    if (!scrollDriven || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let frame: number | undefined
    const update = () => {
      frame = undefined
      const root = rootRef.current
      if (!root) return
      const rect = root.getBoundingClientRect()
      const viewport = window.innerHeight
      // Begins before the pile reaches center screen and completes shortly
      // after it has passed it, so the scroll feels like moving papers rather
      // than a delayed entrance animation.
      const progress = Math.max(0, Math.min(1, (viewport * 0.82 - rect.top) / (rect.height + viewport * 0.18)))
      const mobile = window.matchMedia('(max-width: 639px)').matches

      itemRefs.current.forEach((item, index) => {
        if (!item) return
        const direction = index % 2 === 0 ? -1 : 1
        const spread = mobile ? 28 + (index % 4) * 8 : 12 + (index % 4) * 4
        const lift = (index % 4) * (mobile ? 8 : 4)
        const rotation = (3 + (index % 3) * 1.5) * direction
        const scale = 1 + (index % 5 === 0 ? 0.055 : -0.018) * progress
        item.style.setProperty('--scroll-delta-x', `${direction * spread * progress}px`)
        item.style.setProperty('--scroll-delta-y', `${-lift * progress}px`)
        item.style.setProperty('--scroll-delta-rotation', `${rotation * progress}deg`)
        item.style.setProperty('--scroll-scale', String(scale))
      })
    }
    const onScroll = () => {
      if (frame === undefined) frame = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame !== undefined) window.cancelAnimationFrame(frame)
    }
  }, [scrollDriven, finalists.length])

  return (
    <div ref={rootRef} className={`obras-collage${animateEntrance ? ' obras-collage--entering' : ''}${scrollDriven ? ' obras-collage--scroll-driven' : ''}`}>
      {showHint && (
        <p className="obras-collage__hint text-center text-sm text-muted-foreground">
          <span className="obras-collage__hint-desktop">{m.collage.hintDesktop}</span>
          <span className="obras-collage__hint-touch">{m.collage.hintTouch}</span>
        </p>
      )}
      <ul className="obras-collage__stage" aria-label={ariaLabel ?? m.collage.label}>
        {finalists.map((artwork, index) => (
          <li
            key={artwork.slug}
            ref={(element) => { itemRefs.current[index] = element }}
            className="obras-collage__item"
            style={{
              '--stack-order': index + 1,
              '--entrance-delay': `${Math.min(index * 35, 280)}ms`,
            } as CSSProperties}
          >
            <ObraLink
              obra={artwork}
              className="obras-collage__window"
              aria-label={fmt(m.collage.viewArtwork, { title: artwork.artworkTitle ?? m.common.untitled, name: artwork.name })}
            >
              <span className="obras-collage__bar" aria-hidden="true">
                <span className="obras-collage__flag">
                  <CountryFlag countryCode={artwork.countryCode} svg={flags[artwork.countryCode.toUpperCase()]} />
                </span>
                <span className="obras-collage__artist">{artwork.name}</span>
                <span className="obras-collage__arrow">↗</span>
              </span>
              {/* Preserve the complete artwork, including portrait and landscape formats. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSrc(artwork.imageUrl, 828)}
                alt={artwork.artworkTitle ?? m.common.untitled}
                width={400}
                height={440}
                loading="lazy"
                decoding="async"
                className="obras-collage__image"
              />
              <span className="obras-collage__caption">{artwork.artworkTitle ?? m.common.untitled}</span>
            </ObraLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
