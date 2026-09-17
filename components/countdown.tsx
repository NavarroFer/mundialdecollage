'use client'

import { useEffect, useState } from 'react'
import { site } from '@/lib/site'

function getTimeLeft() {
  const deadline = new Date(site.deadlineISO).getTime()
  const now = Date.now()
  const diff = Math.max(0, deadline - now)

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    closed: diff === 0,
  }
}

const units: { key: 'days' | 'hours' | 'minutes'; label: string }[] = [
  { key: 'days', label: 'días' },
  { key: 'hours', label: 'horas' },
  { key: 'minutes', label: 'min' },
]

export function Countdown() {
  const [time, setTime] = useState<ReturnType<typeof getTimeLeft> | null>(null)

  useEffect(() => {
    setTime(getTimeLeft())
    const id = setInterval(() => setTime(getTimeLeft()), 30_000)
    return () => clearInterval(id)
  }, [])

  if (!time || time.closed) return null

  return (
    <div className="inline-flex items-center gap-3 rounded-2xl border-2 border-ink/15 bg-card/80 px-4 py-3 shadow-sm">
      {units.map((u, i) => (
        <div key={u.key} className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            <span className="font-display text-2xl leading-none text-collage-blue tabular-nums sm:text-3xl">
              {String(time[u.key]).padStart(2, '0')}
            </span>
            <span className="mt-1 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
              {u.label}
            </span>
          </div>
          {i < units.length - 1 && <span className="text-lg text-ink/20">·</span>}
        </div>
      ))}
    </div>
  )
}
