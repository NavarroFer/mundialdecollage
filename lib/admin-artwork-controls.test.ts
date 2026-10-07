import { describe, expect, it } from 'vitest'
import { hasSubmissionSearch, matchesSubmissionSearch, pendingArtworkGroups, submissionSearchEntry, isArtworkPublished } from './admin-artwork-controls'
import type { Submission } from '@/components/admin/submission-types'

const submission: Submission = {
  id: 'legacy-1', legacyId: '1', name: 'José Pérez', artworkTitle: 'Mar del Sur',
  imageUrl: 'https://example.com/photo.jpg', source: 'legacy',
  isPublic: true, reviewStatus: 'unreviewed', email: 'jose@example.com',
  instagram: 'https://instagram.com/jose.collage',
  legacySiblings: [{ id: '2', name: 'José Pérez', imageUrl: 'https://example.com/other.jpg', driveUrl: 'https://drive.google.com/file/d/123/view', selected: false, promoted: false, imageFetchFailedAt: null }],
}

describe('Admin Obras controls', () => {
  it('keeps only artists with multiple works and an unconfirmed choice', () => {
    const pending = { profiles: { entries_chosen_at: null } }
    const confirmed = { profiles: { entries_chosen_at: '2026-10-06T12:00:00Z' } }
    expect(pendingArtworkGroups(new Map<string, { profiles: { entries_chosen_at: string | null } | null }[]>([
      ['pending', [pending, pending]], ['chosen', [confirmed, confirmed]],
      ['single', [pending]], ['missing-profile', [{ profiles: null }, { profiles: null }]],
    ])).map(([id]) => id)).toEqual(['pending'])
  })
  it('does not ship images, original links or sibling lists in the text index', () => {
    const result = submissionSearchEntry(submission)
    expect(result.id).toBe('legacy-1')
    expect(result.name).toBe('José Pérez')
    expect(result).not.toHaveProperty('imageUrl')
    expect(result).not.toHaveProperty('legacySiblings')
    expect(JSON.stringify(result)).not.toContain('photo.jpg')
    expect(JSON.stringify(result)).not.toContain('drive.google.com')
  })
  it('does not mark an additional stored work as published just because its artist is public', () => {
    expect(isArtworkPublished(true, true)).toBe(true)
    expect(isArtworkPublished(true, false)).toBe(false)
    expect(isArtworkPublished(false, true)).toBe(false)
    expect(isArtworkPublished(true, undefined)).toBe(false)
  })
  it('finds artists and titles regardless of accents, and searches email and Instagram', () => {
    const entry = submissionSearchEntry(submission)
    expect(matchesSubmissionSearch(entry, 'jose perez')).toBe(true)
    expect(matchesSubmissionSearch(entry, 'sur jose')).toBe(true)
    expect(matchesSubmissionSearch(entry, 'jose@example')).toBe(true)
    expect(matchesSubmissionSearch(entry, 'jose.collage')).toBe(true)
    expect(matchesSubmissionSearch(entry, 'otro artista')).toBe(false)
  })
  it('keeps the full catalog hidden until a search or filter is chosen', () => {
    expect(hasSubmissionSearch('', ['all', 'all'])).toBe(false)
    expect(hasSubmissionSearch(' a ', ['all'])).toBe(false)
    expect(hasSubmissionSearch('jose', ['all'])).toBe(true)
    expect(hasSubmissionSearch('', ['pending'])).toBe(true)
  })
})
