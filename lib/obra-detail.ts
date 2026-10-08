import type { ArtworkSummary, Finalist } from '@/lib/finalists'

// What an obra's page and its popup (components/obra-modal.tsx) show around
// the obra itself: up to three more by the same artist, and the obras before
// and after it in the public listing (newest first, as getFinalists()).
export type ObraNeighbors = {
  related: ArtworkSummary[]
  previous: ArtworkSummary | null
  next: ArtworkSummary | null
}

// What app/api/obras/[slug] serves the popup: everything /obras/[slug] shows.
export type ObraDetail = ObraNeighbors & {
  obra: Finalist
  artistHref: string
  callOpen: boolean
}

export function toSummary({ slug, artworkTitle, name, countryCode, imageUrl }: ArtworkSummary): ArtworkSummary {
  return { slug, artworkTitle, name, countryCode, imageUrl }
}

export function obraNeighbors(finalists: Finalist[], obra: Finalist): ObraNeighbors {
  const related = finalists
    .filter((artwork) => artwork.profileId === obra.profileId && artwork.slug !== obra.slug)
    .slice(0, 3)
    .map(toSummary)
  const index = finalists.findIndex((artwork) => artwork.slug === obra.slug)
  const previous = index > 0 ? toSummary(finalists[index - 1]) : null
  const next = index >= 0 && index < finalists.length - 1 ? toSummary(finalists[index + 1]) : null
  return { related, previous, next }
}
