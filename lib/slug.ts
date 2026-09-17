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
