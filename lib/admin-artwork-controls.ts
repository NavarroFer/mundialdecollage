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
    createdAt: submission.createdAt, isPublic: submission.isPublic, profileIsPublic: submission.profileIsPublic,
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

/** An artist can be public while their additional stored works are not. */
export function isArtworkPublished(profileIsPublic: boolean, isSelected: boolean | null | undefined) {
  return profileIsPublic && isSelected === true
}
