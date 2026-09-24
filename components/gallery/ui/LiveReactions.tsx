'use client'

import { REACTIONS } from '../presence/protocol'
import { usePresenceStore } from '../presence/store'
import styles from '../gallery-theme.module.css'

export function LiveReactions({ artworkId }: { artworkId: string }) {
  const react = usePresenceStore((state) => state.react)
  // Select the whole list and filter here — a filtered selector would return
  // a new array every time and re-render forever.
  const reactions = usePresenceStore((state) => state.reactions)

  // Hidden while Realtime is unavailable instead of offering dead buttons.
  if (!react) return null
  const floating = reactions.filter((reaction) => reaction.artworkId === artworkId)

  return (
    <div className="relative">
      <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Reaccioná en vivo</p>
      <div className="flex gap-2">
        {REACTIONS.map(({ emoji, label }) => (
          <button key={emoji} type="button" onClick={() => react(artworkId, emoji)} aria-label={label} title={label}
            className="flex h-11 w-11 items-center justify-center border border-ink/20 text-xl transition-transform hover:scale-110 active:scale-95">
            {emoji}
          </button>
        ))}
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-full h-28">
        {floating.map((reaction) => (
          <span key={reaction.id} className={styles.floatingReaction} style={{ left: `${40 + reaction.offset * 70}%` }}>
            {reaction.emoji}
          </span>
        ))}
      </div>
    </div>
  )
}
