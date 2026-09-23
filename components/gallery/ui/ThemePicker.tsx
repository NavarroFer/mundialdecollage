'use client'

import { useState } from 'react'
import { Check, Palette, X } from 'lucide-react'
import { galleryThemes, GALLERY_THEMES, type GalleryTheme } from '../themes'
import styles from '../gallery-theme.module.css'

const swatches: Record<GalleryTheme, string> = {
  collage: 'linear-gradient(90deg, #e8dcc4 0 38%, #d84b38 38% 55%, #487a65 55% 75%, #e4b84a 75%)',
  windows98: 'linear-gradient(90deg, #008080 0 33%, #c0c0c0 33% 66%, #000080 66%)',
  garden: 'linear-gradient(90deg, #8fd3ff 0 30%, #72ad53 30% 58%, #ffcf45 58% 74%, #ef6f61 74%)',
}

export function ThemePicker({ theme, onChange }: { theme: GalleryTheme; onChange: (theme: GalleryTheme) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <aside className={styles.themePicker}>
      {open && (
        <div className={styles.themeMenu} role="radiogroup" aria-label="Tema de la galería">
          <div className={styles.themeMenuTitle}>
            <span>Elegir tema</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar selector de temas"><X size={15} /></button>
          </div>
          {GALLERY_THEMES.map((id) => {
            const option = galleryThemes[id]
            const selected = id === theme
            return (
              <button key={id} type="button" role="radio" aria-checked={selected}
                onClick={() => { onChange(id); setOpen(false) }} className={styles.themeMenuOption}>
                <span className={styles.themeMenuSwatch} style={{ background: swatches[id] }} />
                <span>{option.name}</span>
                {selected && <Check size={14} aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      )}
      <button type="button" className={styles.themeTrigger} onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Cerrar selector de temas' : `Cambiar tema. Tema actual: ${galleryThemes[theme].name}`}
        aria-expanded={open}>
        <Palette size={19} aria-hidden="true" />
      </button>
    </aside>
  )
}
