'use client'

import Link from 'next/link'
import { track } from '@/lib/track'
import styles from '../gallery-theme.module.css'
import { PresenceNote } from './PresenceCounter'
import { useI18n } from '@/lib/i18n/client'

type StartScreenProps = {
  label: string
  hint: string
  /** Show how many people are inside — only meaningful before the first entry. */
  showPresence: boolean
  onEnter: () => void
}

export function StartScreen({ label, hint, showPresence, onEnter }: StartScreenProps) {
  const { m } = useI18n()
  return (
    <div className={`${styles.startScreen} animate-in fade-in absolute inset-0 z-30 flex items-center justify-center p-4 duration-300`}>
      <section className={styles.startPanel} aria-labelledby="gallery-start-title">
        <div className={styles.windowsTitlebar} aria-hidden="true">
          <span>museo.exe</span><span>□ ×</span>
        </div>
        <p className="mb-2 text-xs font-bold tracking-[0.18em] opacity-60">{m.gallery.startEyebrow}</p>
        <h1 id="gallery-start-title" className={styles.title}>{m.gallery.startTitle}</h1>
      <button
        type="button"
        id="gallery-enter-button"
        onClick={onEnter}
        className={styles.enterButton}
      >
        {label}
      </button>
      {showPresence && <PresenceNote />}
      <p className={styles.hint}>{hint}</p>
      {/* The way back to the rest of the Mundial — signed-in visitors who
          haven't finished signing up get asked to there (ParticipationStatus). */}
      <Link href="/" onClick={() => track('home_from_gallery')} className="mt-4 inline-block text-sm font-semibold underline opacity-80 hover:opacity-100">
        {m.gallery.homeLink}
      </Link>
      </section>
    </div>
  )
}
