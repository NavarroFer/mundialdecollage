'use client'

import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/client'
import styles from '../gallery-theme.module.css'
import { useFlagHintStore } from './store'

// Where the hand's fingertip is in its drawing, at 56 pixels wide.
const FINGERTIP = { x: 20, y: 2 }

/**
 * Near MAR's hall flag: a hand cursor floating over the mosaic, roaming from
 * picture to picture and clicking each, over what opens one (a click or E;
 * a tap on a phone). FlagTracker says where the cloth is on screen, and the
 * hand follows it without re-rendering.
 */
export function FlagHint({ touch }: { touch: boolean }) {
  const { m } = useI18n()
  const shown = useFlagHintStore((state) => state.spot !== null)
  const ref = useRef<HTMLDivElement>(null)

  // Before paint, so it never flashes at the corner.
  useLayoutEffect(() => {
    if (!shown) return
    const place = ({ spot }: { spot: { x: number; y: number } | null }) => {
      if (spot && ref.current) ref.current.style.transform = `translate(${spot.x}px, ${spot.y}px)`
    }
    place(useFlagHintStore.getState())
    return useFlagHintStore.subscribe(place)
  }, [shown])

  if (!shown) return null
  return (
    <div ref={ref} className="pointer-events-none absolute top-0 left-0 z-30" role="status">
      <div className="animate-in fade-in relative duration-300 motion-reduce:animate-none">
        <div className={`${styles.flagHint} relative`}>
          <div className={`${styles.flagHintRoam} relative`}>
            <span className={`${styles.flagHintRing} absolute -top-8 -left-8 size-16 rounded-full border-4 border-paper shadow-[0_0_0_1.5px_rgba(0,0,0,0.45)]`} aria-hidden="true" />
            <HandCursor className={`${styles.flagHintHand} absolute h-[65px] w-14`} style={{ left: -FINGERTIP.x, top: -FINGERTIP.y }} />
          </div>
          <p className="absolute top-[4.75rem] left-0 flex w-max max-w-80 -translate-x-1/2 items-center gap-1.5 rounded-2xl bg-ink px-3.5 py-1.5 text-sm leading-tight font-semibold text-paper shadow-md">
            {touch ? m.gallery.flagHint.tap : <>
              <kbd className="rounded border border-paper/70 px-1.5 py-0.5 text-xs">{m.gallery.controls.click}</kbd>
              /
              <kbd className="rounded border border-paper/70 px-1.5 py-0.5 text-xs">E</kbd>
              <span className="ml-0.5">{m.gallery.flagHint.detail}</span>
            </>}
          </p>
        </div>
      </div>
    </div>
  )
}

/** The pointing hand of a link cursor: white, outlined in black, fingers marked. */
function HandCursor({ className, style }: { className: string; style: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 28" className={className} style={style} aria-hidden="true">
      <path
        d="M8.5 1C9.4 1 10 1.7 10 2.6V10.2C10.3 9.6 10.9 9.3 11.5 9.3C12.4 9.3 13 10 13 10.8V11.2C13.3 10.6 13.9 10.3 14.5 10.3C15.4 10.3 16 11 16 11.8V12.4C16.3 11.9 16.9 11.6 17.5 11.6C18.4 11.6 19 12.3 19 13.1V19.5C19 23 17 26 13.5 26H11C9 26 7.6 25 6.6 23.6L2.6 18.2C2 17.4 2.2 16.3 3 15.8C3.8 15.3 4.8 15.5 5.4 16.2L7 18V2.6C7 1.7 7.6 1 8.5 1Z"
        fill="#fff"
        stroke="#111"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M10 10.2V14.5M13 11.2V15M16 12.4V15.5" fill="none" stroke="#111" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}
