'use client'

import { useInteractionStore } from '../interaction/store'

export function InteractionPrompt() {
  const targetId = useInteractionStore((state) => state.targetId)
  const openId = useInteractionStore((state) => state.openId)

  if (!targetId || openId) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-16 flex justify-center">
      <div className="flex items-center gap-2 rounded-full bg-ink/80 px-5 py-2 text-sm font-semibold text-paper shadow-lg">
        <kbd className="rounded bg-paper/20 px-2 py-0.5 font-display text-xs">E</kbd>
        Ver obra
      </div>
    </div>
  )
}
