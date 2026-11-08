'use client'

import { Check } from 'lucide-react'
import { GALLERY_VENUES, type GalleryVenue } from '../venue'
import styles from '../gallery-theme.module.css'
import { useI18n } from '@/lib/i18n/client'
import { useGalleryPreferences } from '../preferences/store'

const swatches: Record<GalleryVenue, string> = {
  mundial: 'linear-gradient(90deg, #e8dcc4 0 55%, #d84b38 55% 78%, #487a65 78%)',
  mar: 'linear-gradient(90deg, #c8c4ba 0 42%, #9ec8ea 42% 70%, #8a8680 70%)',
}

/** The same radio list as the theme picker, for which building you walk. */
export function VenuePicker() {
  const venue = useGalleryPreferences((state) => state.venue)
  const update = useGalleryPreferences((state) => state.update)
  const t = useI18n().m.gallery.venues
  return (
    <div className={styles.themeMenu} role="radiogroup" aria-label={t.label}>
      <div className={styles.themeMenuTitle}><span>{t.choose}</span></div>
      {GALLERY_VENUES.map((id) => {
        const selected = id === venue
        return (
          <button key={id} type="button" role="radio" aria-checked={selected}
            onClick={() => update({ venue: id })} className={styles.themeMenuOption}>
            <span className={styles.themeMenuSwatch} style={{ background: swatches[id] }} />
            <span>{t[id]}</span>
            {selected && <Check size={14} aria-hidden="true" />}
          </button>
        )
      })}
      {venue === 'mar' && <p className="px-3 py-2 text-xs leading-snug opacity-80">{t.marNote}</p>}
    </div>
  )
}
