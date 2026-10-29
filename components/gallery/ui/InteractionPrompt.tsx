'use client'

import { useVinylStore } from '../vinyl/store'
import { useArcadeStore } from '../arcade/store'
import { useInteractionStore } from '../interaction/store'
import { useWallStore } from '../wall/store'
import { useClubDoorStore } from '../club/store'
import { useClubHostStore } from '../club/host'
import type { GalleryTheme } from '../themes'
import styles from '../gallery-theme.module.css'
import { useI18n } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/format'

export function InteractionPrompt({ theme: _theme, hostName }: { theme: GalleryTheme; hostName?: string }) {
  const vinyl = useVinylStore((state) => state.aiming)
  const arcade = useArcadeStore((state) => state.aiming)
  const targetId = useInteractionStore((state) => state.targetId)
  const openId = useInteractionStore((state) => state.openId)
  const aimingAtWall = useWallStore((state) => state.aiming && !state.placing)
  const door = useClubDoorStore((state) => (state.aiming ? state.next : null))
  const host = useClubHostStore((state) => state.aiming)
  const { m } = useI18n()

  if (openId || (!vinyl && !arcade && !targetId && !aimingAtWall && !door && !host)) return null

  return (
    <div className="animate-in fade-in pointer-events-none absolute inset-x-0 bottom-16 flex justify-center duration-150">
      <div className={`${styles.hudPanel} flex items-center gap-2 px-5 py-2 text-sm font-semibold`}>
        {/* A click on the obra (or with the crosshair on it) opens it too. */}
        {targetId && <><kbd className="border border-current px-2 py-0.5 text-xs">{m.gallery.controls.click}</kbd>/</>}
        <kbd className="border border-current px-2 py-0.5 text-xs">E</kbd>
        {vinyl ? 'Elegir música' : arcade ? 'Jugar Snake' : targetId ? m.gallery.viewArtwork : host && hostName ? fmt(m.gallery.clubHost.prompt, { name: hostName }) : door ? fmt(m.gallery.clubDoor.prompt, { name: door.artistName }) : m.gallery.wall.prompt}
      </div>
    </div>
  )
}
