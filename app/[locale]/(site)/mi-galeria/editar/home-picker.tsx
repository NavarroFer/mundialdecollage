'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/admin/submit-button'
import type { ClubHouse } from '@/lib/club-map'
import type { ClubMapTexts } from '@/components/club/club-map'
import { saveGalleryHome } from './actions'

const ClubMap = dynamic(() => import('@/components/club/club-map').then((m) => m.ClubMap), {
  ssr: false,
  loading: () => <div className="aspect-[4/3] w-full sm:aspect-[40/21] animate-pulse rounded-2xl bg-muted" aria-hidden />,
})

// The member clicks the map where their house goes. The other houses come
// from the same CDN list as the public map, for company.
export function HomePicker({ slug, home, texts, labels }: {
  slug: string
  home: [number, number] | null
  texts: ClubMapTexts
  labels: { save: string; clear: string; none: string }
}) {
  const [picked, setPicked] = useState<[number, number] | null>(home)
  const [houses, setHouses] = useState<ClubHouse[]>([])

  useEffect(() => {
    let active = true
    fetch('/api/club/casas')
      .then((response) => (response.ok ? (response.json() as Promise<ClubHouse[]>) : []))
      .then((list) => { if (active) setHouses(list.filter((house) => house.slug !== slug)) })
      .catch(() => {})
    return () => { active = false }
  }, [slug])

  return (
    <div className="space-y-4">
      <ClubMap houses={houses} texts={texts} picked={picked} onPick={setPicked} initialCenter={home ?? undefined} initialZoom={home ? 6 : 1} />
      {!picked && <p className="text-sm text-muted-foreground">{labels.none}</p>}
      <div className="flex flex-wrap gap-3">
        <form action={saveGalleryHome} className="flex-1">
          <input type="hidden" name="home_lat" value={picked ? picked[1] : ''} />
          <input type="hidden" name="home_lng" value={picked ? picked[0] : ''} />
          <SubmitButton disabled={!picked} className="min-h-11 w-full">{labels.save}</SubmitButton>
        </form>
        {home && (
          <form action={saveGalleryHome}>
            <Button type="submit" variant="outline" className="min-h-11" onClick={() => setPicked(null)}>{labels.clear}</Button>
          </form>
        )}
      </div>
    </div>
  )
}
