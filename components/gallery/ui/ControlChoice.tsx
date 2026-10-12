'use client'

import { Gamepad2, MousePointerClick } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { useGalleryPreferences, type ControlMode } from '../preferences/store'
import styles from '../gallery-theme.module.css'

const MODES: ControlMode[] = ['point', 'classic']

/**
 * How to walk: by clicks or taps on the floor, or the videogame way (keys
 * and mouse, or the joystick). Remembered in the browser, and both keep
 * working whichever is chosen: this only picks how the mouse looks around
 * and what the tutorial teaches.
 */
export function ControlChoice({ touch }: { touch: boolean }) {
  const mode = useGalleryPreferences((state) => state.controlMode)
  const t = useI18n().m.gallery.controls
  const copy = {
    point: touch ? { title: t.tapTitle, body: t.tapBody } : { title: t.clickTitle, body: t.clickBody },
    classic: touch ? { title: t.joystickTitle, body: t.joystickBody } : { title: t.keyboardTitle, body: t.keyboardBody },
  }
  return (
    <fieldset className={styles.controlChoice}>
      <legend className="mb-2 text-sm font-bold">{t.choose}</legend>
      <div className={styles.controlCards}>
        {MODES.map((value) => {
          const Icon = value === 'point' ? MousePointerClick : Gamepad2
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
              <strong>{copy[value].title}</strong>
              <span>{copy[value].body}</span>
            </label>
          )
        })}
      </div>
      <p className="mt-2 text-xs opacity-75">{t.switchAnytime}</p>
    </fieldset>
  )
}
