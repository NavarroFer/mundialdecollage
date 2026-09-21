import { Suspense } from 'react'
import { artworks } from '@/data/artworks'
import { Artwork } from './Artwork'

export function Artworks() {
  return (
    <Suspense fallback={null}>
      {artworks.map((data) => (
        <Artwork key={data.id} data={data} />
      ))}
    </Suspense>
  )
}
