// The card shown when the pointer rests on an artist in the feed. The same
// shape is built on the server (lib/artist-card-data.ts, from public rows) and
// read in the browser, which asks for it once per artist.
import { imageSrc } from '@/lib/image-src'
import { instagramHandle } from '@/lib/instagram'

export type ArtistCard = {
  name: string
  countryCode: string
  /** Handle without the @, or null. */
  instagram: string | null
  /** An http(s) link, or null. */
  website: string | null
  /** The two or three techniques used most across their obras. */
  techniques: string[]
  artworks: number
  images: string[]
}

export type ArtistCardRow = {
  slug: string | null
  technique: string | null
  image_url: string | null
  profiles: {
    name: string | null
    country_code: string | null
    instagram: string | null
    website: string | null
  } | null
}

const MAX_TECHNIQUES = 3
const MAX_IMAGES = 3

/** The profile's most frequent techniques, grouped ignoring case and spacing. */
export function topTechniques(values: (string | null)[], limit = MAX_TECHNIQUES): string[] {
  const counts = new Map<string, { label: string; count: number }>()
  for (const value of values) {
    const label = value?.trim().replace(/\s+/g, ' ')
    if (!label) continue
    const key = label.toLocaleLowerCase()
    const entry = counts.get(key)
    if (entry) entry.count += 1
    else counts.set(key, { label, count: 1 })
  }
  // Array.sort is stable: equal counts keep the order the obras came in.
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit).map((entry) => entry.label)
}

function httpUrl(value: string | null | undefined): string | null {
  try {
    const url = new URL((value ?? '').trim())
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

/**
 * Same rule as the profile page (lib/artist-profiles.ts): a profile with no
 * name, no country or no obra with a photo is not public, so it has no card.
 */
export function buildArtistCard(rows: ArtistCardRow[]): ArtistCard | undefined {
  const profile = rows[0]?.profiles
  if (!profile?.name || !profile.country_code) return undefined
  const shown = rows.filter((row) => row.slug && row.image_url)
  if (shown.length === 0) return undefined
  const handle = instagramHandle(profile.instagram)
  return {
    name: profile.name,
    countryCode: profile.country_code,
    instagram: handle,
    website: httpUrl(profile.website),
    techniques: topTechniques(shown.map((row) => row.technique)),
    artworks: shown.length,
    images: shown.slice(0, MAX_IMAGES).map((row) => imageSrc(row.image_url!, 320)),
  }
}

// One request per artist for the whole visit: the card is public and the CDN
// keeps it, so the browser never asks twice. Failures are forgotten so the
// next hover can try again; «not public» (404) is remembered.
const loads = new Map<string, Promise<ArtistCard | null>>()

export function loadArtistCard(profileId: string, fetcher: typeof fetch = fetch): Promise<ArtistCard | null> {
  const known = loads.get(profileId)
  if (known) return known
  const load = fetcher(`/api/artistas/${profileId}/tarjeta`)
    .then(async (response) => {
      if (response.status === 404) return null
      if (!response.ok) throw new Error(`card ${response.status}`)
      return (await response.json()) as ArtistCard
    })
    .catch((error) => {
      loads.delete(profileId)
      throw error
    })
  loads.set(profileId, load)
  return load
}

/** For tests: forget what the module remembers. */
export function resetArtistCards() {
  loads.clear()
}
