import { needsEntryChoice } from '@/lib/entries'
import { normalizeSearch } from '@/lib/artwork-search'
import type { Submission, SubmissionSearchEntry } from '@/components/admin/submission-types'

export function pendingArtworkGroups<T extends { profiles: { entries_chosen_at: string | null } | null }>(groups: Map<string, T[]>) {
  return [...groups.entries()].filter(([, rows]) => rows[0]?.profiles && needsEntryChoice(rows.length, rows[0].profiles.entries_chosen_at))
}

// The browser receives a small text index. Photos, original links and sibling
// details are fetched only after a result is opened.
export function submissionSearchEntry(submission: Submission): SubmissionSearchEntry {
  return {
    id: submission.id, name: submission.name, countryCode: submission.countryCode,
    artworkTitle: submission.artworkTitle, technique: submission.technique,
    email: submission.email, instagram: submission.instagram,
    createdAt: submission.createdAt, isPublic: submission.isPublic, unpublishedReason: submission.unpublishedReason, profileIsPublic: submission.profileIsPublic,
    reviewStatus: submission.reviewStatus, artworkCount: submission.artworkCount,
    source: submission.source, artworkId: submission.artworkId, legacyId: submission.legacyId,
  }
}

export function matchesSubmissionSearch(entry: SubmissionSearchEntry, query: string) {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean)
  const text = normalizeSearch([entry.name, entry.artworkTitle, entry.email, entry.instagram].filter(Boolean).join(' '))
  return words.every(word => text.includes(word))
}

export function hasSubmissionSearch(query: string, filters: string[]) {
  return query.trim().length >= 2 || filters.some(value => value !== 'all')
}

/**
 * An artist can be public while their additional stored works are not —
 * except the ones they paid to enter (public.artwork_on_show): pass
 * `paidEntry` for an entered obra of an artist who paid.
 */
export function isArtworkPublished(profileIsPublic: boolean, isSelected: boolean | null | undefined, paidEntry = false) {
  return profileIsPublic && (isSelected === true || paidEntry)
}

// Why an obra in /admin/obras isn't on the site. «Sin publicar» used to be one
// number that mixed what an admin can publish right away with what is
// unpublished on purpose (one free obra per artist).
export type UnpublishedReason = 'artist_hidden' | 'another_obra' | 'not_chosen'

export const UNPUBLISHED_REASONS: Record<UnpublishedReason, { label: string; short: string; description: string }> = {
  artist_hidden: {
    label: 'Elegidas, con el artista sin publicar',
    short: 'Artista sin publicar',
    description: 'Es la obra que participa, pero el artista todavía no está publicado. Se publican seleccionándolas y tocando «Estas participan».',
  },
  another_obra: {
    label: 'Otra obra del mismo artista',
    short: 'Otra obra del artista',
    description: 'El artista ya participa con otra: gratis participa una sola, y quien pagó puede no haberla marcado.',
  },
  not_chosen: {
    label: 'Sin obra elegida',
    short: 'Sin elegir',
    description: 'Nadie eligió todavía que esta obra participe.',
  },
}

/**
 * `chosen`: this is the obra that takes part — the artist's main one, or
 * another they paid to enter (for a Registro row not yet linked to an
 * account, the row picked for its email). Undefined when it is public.
 */
export function unpublishedReason({ isPublic, chosen, artworkCount }: { isPublic: boolean; chosen: boolean; artworkCount: number }): UnpublishedReason | undefined {
  if (isPublic) return undefined
  if (chosen) return 'artist_hidden'
  return artworkCount > 1 ? 'another_obra' : 'not_chosen'
}
