'use client'

import type { ObraEntry } from '@/lib/artwork-search'

// One request per visit to /api/obras, shared by the homepage search and the
// map; a failed one is forgotten so the next caller can try again.
let pending: Promise<ObraEntry[]> | null = null

export function loadObras(): Promise<ObraEntry[]> {
  pending ??= fetch('/api/obras')
    .then((response) => {
      if (!response.ok) throw new Error(String(response.status))
      return response.json() as Promise<ObraEntry[]>
    })
    .catch((error) => {
      pending = null
      throw error
    })
  return pending
}
