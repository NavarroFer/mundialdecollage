import { getArtworkSocial, type ArtworkSocial } from '@/app/[locale]/(site)/galeria-3d/actions'

export type SocialResult = ArtworkSocial | { error: string }

type Entry = { at: number; promise: Promise<SocialResult>; result?: ArtworkSocial }

// Short enough that counts stay current while walking around; a like or a
// comment drops the obra's entry right away (forgetArtworkSocial).
const FRESH_MS = 30_000
const cache = new Map<string, Entry>()

function fresh(slug: string) {
  const entry = cache.get(slug)
  return entry && Date.now() - entry.at < FRESH_MS ? entry : undefined
}

// Likes + comments for an obra, shared between the prefetch (player looking
// at it) and the modal, so pressing E usually finds them already here.
export function loadArtworkSocial(slug: string): Promise<SocialResult> {
  const cached = fresh(slug)
  if (cached) return cached.promise
  const entry: Entry = {
    at: Date.now(),
    promise: getArtworkSocial(slug).catch(() => ({ error: 'unavailable' })),
  }
  entry.promise.then((result) => {
    if ('error' in result) {
      // Failures aren't cached: the next look or retry asks again.
      if (cache.get(slug) === entry) cache.delete(slug)
    } else {
      entry.result = result
    }
  })
  cache.set(slug, entry)
  return entry.promise
}

/** The obra's data if it already arrived, so the modal can open with it on the first frame. */
export function peekArtworkSocial(slug: string): ArtworkSocial | undefined {
  return fresh(slug)?.result
}

export function forgetArtworkSocial(slug: string) {
  cache.delete(slug)
}
