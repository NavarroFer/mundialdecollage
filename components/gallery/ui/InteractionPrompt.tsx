'use client'

import { useArcadeStore } from '../arcade/store'
import { useInteractionStore } from '../interaction/store'
import { useWallStore } from '../wall/store'
import type { GalleryTheme } from '../themes'
import styles from '../gallery-theme.module.css'
import { useI18n } from '@/lib/i18n/client'

export function InteractionPrompt({ theme: _theme }: { theme: GalleryTheme }) {
  const arcade = useArcadeStore((state) => state.aiming)
  const targetId = useInteractionStore((state) => state.targetId)
  const openId = useInteractionStore((state) => state.openId)
  const aimingAtWall = useWallStore((state) => state.aiming && !state.placing)
  const { m } = useI18n()

  if (openId || (!arcade && !targetId && !aimingAtWall)) return null

  return (
    <div className="animate-in fade-in pointer-events-none absolute inset-x-0 bottom-16 flex justify-center duration-150">
      <div className={`${styles.hudPanel} flex items-center gap-2 px-5 py-2 text-sm font-semibold`}>
        {/* A click on the obra (or with the crosshair on it) opens it too. */}
        {targetId && <><kbd className="border border-current px-2 py-0.5 text-xs">{m.gallery.controls.click}</kbd>/</>}
        <kbd className="border border-current px-2 py-0.5 text-xs">E</kbd>
        {arcade ? 'Jugar Snake' : targetId ? m.gallery.viewArtwork : m.gallery.wall.prompt}
      </div>
    </div>
  )
}
