'use client'

import { useState } from 'react'
import { Check, Palette, X } from 'lucide-react'
import { GALLERY_THEMES, type GalleryTheme } from '../themes'
import styles from '../gallery-theme.module.css'
import { useI18n } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/format'

const swatches: Record<GalleryTheme, string> = {
  collage: 'linear-gradient(90deg, #e8dcc4 0 38%, #d84b38 38% 55%, #487a65 55% 75%, #e4b84a 75%)',
  windows98: 'linear-gradient(90deg, #008080 0 33%, #c0c0c0 33% 66%, #000080 66%)',
  garden: 'linear-gradient(90deg, #8fd3ff 0 30%, #72ad53 30% 58%, #ffcf45 58% 74%, #ef6f61 74%)',
}

export function ThemePicker({ theme, onChange, inline = false }: { theme: GalleryTheme; onChange: (theme: GalleryTheme) => void; inline?: boolean }) {
  const [open, setOpen] = useState(false)
  const { m } = useI18n()
  const t = m.gallery.themes

  return (
    <aside className={styles.themePicker}>
      {(open || inline) && (
        <div className={styles.themeMenu} role="radiogroup" aria-label={t.label}>
          <div className={styles.themeMenuTitle}>
            <span>{t.choose}</span>
            {!inline && <button type="button" onClick={() => setOpen(false)} aria-label={t.close}><X size={15} /></button>}
          </div>
          {GALLERY_THEMES.map((id) => {
            const selected = id === theme
            return (
              <button key={id} type="button" role="radio" aria-checked={selected}
                onClick={() => { onChange(id); setOpen(false) }} className={styles.themeMenuOption}>
                <span className={styles.themeMenuSwatch} style={{ background: swatches[id] }} />
                <span>{t.names[id]}</span>
                {selected && <Check size={14} aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      )}
      {!inline && <button type="button" className={styles.themeTrigger} onClick={() => setOpen((value) => !value)}
        aria-label={open ? t.close : fmt(t.change, { name: t.names[theme] })}
        aria-expanded={open}>
        <Palette size={19} aria-hidden="true" />
      </button>}
    </aside>
  )
}
