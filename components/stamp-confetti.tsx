'use client'

import type { CSSProperties } from 'react'

export function StampConfetti({ visible }: { visible: boolean }) {
  if (!visible) return null
  return <div className="stamp-confetti" aria-hidden="true">{Array.from({ length: 22 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}</div>
}
