'use client'

import { useEffect, useState } from 'react'
import { StampConfetti } from '@/components/stamp-confetti'
import { announceStampUnlocked } from '@/lib/stamps'

export function StampVisit({ stamp }: { stamp: 'gallery' | 'world' }) {
  const [celebrate, setCelebrate] = useState(false)
  useEffect(() => {
    void fetch('/api/stamps', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stamp }) })
      .then((response) => response.ok ? response.json() as Promise<{ awarded: boolean }> : null)
      .then((data) => {
        if (!data) return
        // Even a stamp earned in a previous visit needs to reach a restored
        // home page whose album came from the router cache.
        announceStampUnlocked(stamp)
        if (data.awarded) { setCelebrate(true); window.setTimeout(() => setCelebrate(false), 2200) }
      })
  }, [stamp])
  return <StampConfetti visible={celebrate} />
}
