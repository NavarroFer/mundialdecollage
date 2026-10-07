'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const SubmissionViewerLoader = dynamic(() => import('./submission-viewer-loader').then(module => module.SubmissionViewerLoader))
type PendingArtist = { id: string; name: string; artworks: { id: string; title: string | null; isSelected: boolean }[] }

export function PendingArtworkChoices({ artists }: { artists: PendingArtist[] }) {
  const [openedId, setOpenedId] = useState<string | null>(null)
  return (
    <div className="mt-5 space-y-3">
      {artists.map(artist => (
        <div key={artist.id} className="rounded-xl border-2 border-ink/10 bg-card p-4">
          <p className="font-semibold text-ink">{artist.name} <span className="text-sm font-normal text-muted-foreground">· {artist.artworks.length} obras</span></p>
          <div className="mt-3 flex flex-wrap gap-2">
            {artist.artworks.map(artwork => (
              <button type="button" key={artwork.id} onClick={() => setOpenedId(artwork.id)} className="rounded-lg border border-ink/15 px-3 py-2 text-left text-sm text-ink hover:border-collage-blue focus-visible:outline-2 focus-visible:outline-collage-blue">
                {artwork.title?.trim() || 'Sin título'}
                {artwork.isSelected && <span className="ml-2 text-xs text-muted-foreground">Principal actual</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
      {openedId && <SubmissionViewerLoader key={openedId} id={openedId} revision={artists} onClose={() => setOpenedId(null)} />}
    </div>
  )
}
