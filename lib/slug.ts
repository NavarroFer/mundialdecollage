// Turns "Sofía Ramírez" into "sofia-ramirez" — strips accents/punctuation so
// the result is safe to use in a URL (feeds /obras/[slug]).
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// An obra's slug becomes a file name in Next's page cache
// (.next/server/app/<locale>/anon/obras/<slug>.html): one artist pasted the
// whole description as the title, its slug went past the 255-byte limit and
// that page is drawn anew on every visit (ENAMETOOLONG). Uniqueness suffixes
// ("-2") add a little on top of this.
export const MAX_ARTWORK_SLUG_LENGTH = 80

/** slugify(), cut at the last whole word that fits in `max`. */
export function boundedSlug(input: string, max = MAX_ARTWORK_SLUG_LENGTH): string {
  const slug = slugify(input)
  if (slug.length <= max) return slug
  const cut = slug.slice(0, max + 1)
  const lastDash = cut.lastIndexOf('-')
  return (lastDash > 0 ? cut.slice(0, lastDash) : slug.slice(0, max)).replace(/-+$/, '')
}
