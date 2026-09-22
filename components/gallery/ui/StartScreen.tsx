'use client'

import styles from '../gallery-theme.module.css'

type StartScreenProps = {
  label: string
  hint: string
  onEnter: () => void
}

export function StartScreen({ label, hint, onEnter }: StartScreenProps) {
  return (
    <div className={`${styles.startScreen} animate-in fade-in absolute inset-0 z-30 flex items-center justify-center p-4 duration-300`}>
      <section className={styles.startPanel} aria-labelledby="gallery-start-title">
        <div className={styles.windowsTitlebar} aria-hidden="true">
          <span>museo.exe</span><span>□ ×</span>
        </div>
        <p className="mb-2 text-xs font-bold tracking-[0.18em] opacity-60">MUNDIAL DE COLLAGE · GALERÍA 3D</p>
        <h1 id="gallery-start-title" className={styles.title}>Recorré la exposición</h1>
      <button
        type="button"
        id="gallery-enter-button"
        onClick={onEnter}
        className={styles.enterButton}
      >
        {label}
      </button>
      <p className={styles.hint}>{hint}</p>
      </section>
    </div>
  )
}
