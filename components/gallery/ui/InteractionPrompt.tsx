'use client'

import { useInteractionStore } from '../interaction/store'
import type { GalleryTheme } from '../themes'
import styles from '../gallery-theme.module.css'

export function InteractionPrompt({ theme: _theme }: { theme: GalleryTheme }) {
  const targetId = useInteractionStore((state) => state.targetId)
  const openId = useInteractionStore((state) => state.openId)

  if (!targetId || openId) return null

  return (
    <div className="animate-in fade-in pointer-events-none absolute inset-x-0 bottom-16 flex justify-center duration-150">
      <div className={`${styles.hudPanel} flex items-center gap-2 px-5 py-2 text-sm font-semibold`}>
        <kbd className="border border-current px-2 py-0.5 text-xs">E</kbd>
        Ver obra
      </div>
    </div>
  )
}
