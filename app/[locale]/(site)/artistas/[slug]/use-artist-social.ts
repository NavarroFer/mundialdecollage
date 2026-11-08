'use client'

import { useEffect, useState } from 'react'
import type { ArtistSocial } from '@/lib/artist-social'

// One request per artist and visit, answered by the CDN
// (app/api/artistas/[slug]/social), shared by the header's counters and the
// feed. A failed one is forgotten so coming back tries again.
const requests = new Map<string, Promise<ArtistSocial>>()

function load(slug: string): Promise<ArtistSocial> {
  let pending = requests.get(slug)
  if (!pending) {
    pending = fetch(`/api/artistas/${encodeURIComponent(slug)}/social`).then((response) => {
      if (!response.ok) throw new Error(String(response.status))
      return response.json() as Promise<ArtistSocial>
    })
    pending.catch(() => requests.delete(slug))
    requests.set(slug, pending)
  }
  return pending
}

/** undefined while it loads, null if it couldn't. */
export function useArtistSocial(slug: string): ArtistSocial | null | undefined {
  const [state, setState] = useState<{ slug: string; social: ArtistSocial | null } | null>(null)
  useEffect(() => {
    let current = true
    load(slug).then(
      (social) => { if (current) setState({ slug, social }) },
      () => { if (current) setState({ slug, social: null }) },
    )
    return () => { current = false }
  }, [slug])
  return state?.slug === slug ? state.social : undefined
}
