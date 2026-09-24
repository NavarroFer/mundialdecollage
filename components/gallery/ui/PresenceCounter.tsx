'use client'

import { usePresenceStore } from '../presence/store'
import { insideLabel, waitingLabel } from '../presence/labels'
import styles from '../gallery-theme.module.css'

// Both read the store directly so a join/leave re-renders only this text, not
// Game and the 3D scene under it. Hidden, never guessed, while the live count
// is unavailable.

export function PresenceCounter() {
  const count = usePresenceStore((state) => state.count)
  if (count === null) return null

  return (
    <div
      title="Personas recorriendo la galería en este momento"
      className={`${styles.hudPanel} animate-in fade-in pointer-events-none absolute top-16 left-4 z-20 flex h-9 items-center gap-2 px-3 text-xs font-semibold duration-300`}
    >
      <span className={styles.liveDot} aria-hidden="true" />
      {insideLabel(count)}
    </div>
  )
}

export function PresenceNote() {
  const count = usePresenceStore((state) => state.count)
  const label = count === null ? null : waitingLabel(count)
  if (!label) return null

  return (
    <p className={styles.presenceNote}>
      <span className={styles.liveDot} aria-hidden="true" />
      {label}
    </p>
  )
}
