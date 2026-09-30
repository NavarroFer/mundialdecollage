// Compartido por SubmissionsGallery, ObraViewer y app/admin/obras/page.tsx (que tipa los
// objetos que construye contra esta misma forma) — así un cambio en page.tsx que deje de
// mandar un campo que el visor espera se detecta en compile-time en vez de en runtime.

export type ArtworkSibling = {
  id: string
  title: string | null
  imageUrl: string | null
  isSelected: boolean
  // Postulated to the contest. Besides the selected one, only an artist who
  // paid for more entries has others (lib/entries.ts).
  isEntered: boolean
}

export type LegacySibling = {
  id: string
  name: string | null
  imageUrl: string | null
  driveUrl: string | null
  selected: boolean
  promoted: boolean
  imageFetchFailedAt: string | null
}

export type Submission = {
  id: string
  name: string
  // For a `source: 'legacy'` row this is a best-effort guess from the
  // free-text country_raw the original import captured (see
  // guessCountryCodeFromName) rather than a real ISO code picked from a
  // list — undefined when nothing in country_raw matched a country name.
  // The viewer's publish button only shows plainly when this (or an
  // already-public row) has one; otherwise it falls back to letting an
  // admin pick a country by hand (see publishLegacySubmissionWithCountry).
  countryCode?: string
  technique?: string
  artworkTitle?: string
  // Full profile URL (profiles.instagram, or built from the Registro handle).
  instagram?: string
  imageUrl: string
  // Used only to order the internal admin intake view.
  createdAt?: string
  // The selected artwork's /obras/[slug] slug, for a `source: 'real'` row.
  slug?: string
  // Only ever set for a `source: 'legacy'` row — the site-stored imageUrl is
  // a resized copy (see lib/legacy-submissions.ts's storeLegacyArtworkGlobally),
  // so this is how an admin gets back to the original file on Drive to judge
  // it at full size.
  driveUrl?: string
  isPublic: boolean
  // Editorial review is independent of publication and of `is_selected`,
  // which only chooses an artist's representative work.
  reviewStatus: 'unreviewed' | 'preselected' | 'rejected'
  // How many artwork rows this artist has total (see
  // supabase/migrations/20260921040000_artworks.sql) — more than one means
  // the gallery viewer should expose the sibling picker.
  artworkCount?: number
  // 'legacy' = a confirmed supabase/migrations/20260921070000_legacy_
  // submissions_promoted.sql row, shown here alongside real registrations so
  // the admin sees everything received in one place, but it has no real
  // `profiles` row yet (the artist hasn't logged in and claimed it) — so
  // unlike a real submission it can't be select-toggled to "Participa"
  // (setSubmissionsVisibility below only ever updates `profiles`).
  source?: 'real' | 'legacy'

  // Only ever set for a `source: 'real'` row — `id` above is the profile_id,
  // not the artworks.id, so this is what selectArtwork/deleteArtwork actually
  // operate on.
  artworkId?: string
  // Only set when this profile has more than one artworks row — lets the
  // viewer switch/delete between them without leaving it.
  siblings?: ArtworkSibling[]

  // Only ever set for a `source: 'legacy'` row — the raw legacy_submissions.id,
  // without the `legacy-` prefix `id` above carries.
  legacyId?: string
  email?: string
  imageFetchFailedAt?: string | null
  // Only set when this email has more than one legacy_submissions row.
  legacySiblings?: LegacySibling[]
}
