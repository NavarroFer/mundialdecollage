'use client'

import { useEffect } from 'react'
import { useI18n } from '@/lib/i18n/client'
import styles from '../gallery-theme.module.css'
import { useNavigationStore } from './store'

// Long enough to read, short enough not to linger over the walk.
const NOTICE_MS = 2500

/** What a click-to-walk is doing: walking (with a way to stop), arrived, or that spot can't be reached. */
export function WalkNotice() {
  const status = useNavigationStore((state) => state.status)
  const t = useI18n().m.gallery.controls

  useEffect(() => {
    if (status !== 'arrived' && status !== 'blocked') return
    const timer = window.setTimeout(() => useNavigationStore.getState().settle(), NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [status])

  if (status === 'idle') return null
  return (
    <div className={`${styles.walkNotice} ${styles.hudPanel}`} role="status">
      <span>{status === 'walking' ? t.walking : status === 'arrived' ? t.arrived : t.blocked}</span>
      {status === 'walking' && (
        <button type="button" onClick={() => useNavigationStore.getState().cancel()}>{t.stop}</button>
      )}
    </div>
  )
}
