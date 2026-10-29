'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import type { ClubHouse } from '@/lib/club-map'
import type { ClubMapTexts } from '@/components/club/club-map'

// react-simple-maps and the world's shapes stay out of the page's first
// load, and the houses come from /api/club/casas (CDN), not the page render.
const ClubMap = dynamic(() => import('@/components/club/club-map').then((m) => m.ClubMap), {
  ssr: false,
  loading: () => <div className="aspect-[4/3] w-full sm:aspect-[40/21] animate-pulse rounded-2xl bg-muted" aria-hidden />,
})

/** The public map of every house. Shows nothing until there is at least one. */
export function ClubHousesSection({ title, body, texts }: { title: string; body: string; texts: ClubMapTexts }) {
  const [houses, setHouses] = useState<ClubHouse[] | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/club/casas')
      .then((response) => (response.ok ? (response.json() as Promise<ClubHouse[]>) : []))
      .then((list) => { if (active) setHouses(list) })
      .catch(() => { if (active) setHouses([]) })
    return () => { active = false }
  }, [])

  if (!houses?.some((house) => house.coordinates)) return null
  return (
    <section className="mt-12" aria-labelledby="club-map-title">
      <h2 id="club-map-title" className="font-display text-3xl uppercase">{title}</h2>
      <p className="mt-2 mb-5 text-muted-foreground">{body}</p>
      <ClubMap houses={houses} texts={texts} />
    </section>
  )
}
