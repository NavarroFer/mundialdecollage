'use client'

import { Crosshair, MousePointer2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { useGalleryPreferences, type ControlMode } from '../preferences/store'
import styles from '../gallery-theme.module.css'

const MODES: ControlMode[] = ['point', 'classic']

/**
 * How a computer looks around: a free cursor that turns the view towards
 * the side it's on (or drags it), or the mouse captured the videogame way
 * (with a crosshair to click where to go).
 * Clicks and WASD walk either way. Remembered in the browser.
 */
export function ControlChoice() {
  const mode = useGalleryPreferences((state) => state.controlMode)
  const t = useI18n().m.gallery.controls
  const copy = {
    point: { title: t.dragTitle, body: t.dragBody, Icon: MousePointer2 },
    classic: { title: t.lockTitle, body: t.lockBody, Icon: Crosshair },
  }
  return (
    <fieldset className={styles.controlChoice}>
      <legend className="mb-2 text-sm font-bold">{t.choose}</legend>
      <div className={styles.controlCards}>
        {MODES.map((value) => {
          const { title, body, Icon } = copy[value]
          return (
            <label key={value} className={styles.controlCard} data-selected={mode === value}>
              <input
                type="radio"
                name="gallery-controls"
                value={value}
                checked={mode === value}
                onChange={() => useGalleryPreferences.getState().update({ controlMode: value })}
                className="sr-only"
              />
              <Icon size={22} aria-hidden="true" />
              <strong>{title}</strong>
              <span>{body}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
