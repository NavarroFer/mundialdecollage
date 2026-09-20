// Lowercase connector particles from the languages this contest's names
// actually come in (Spanish, Portuguese, Italian, French, Dutch, German) —
// kept lowercase inside a name ("Maria de la Cruz") but still capitalized
// when they open it ("De la Cruz Maria"), same convention style guides use.
const LOWERCASE_PARTICLES = new Set([
  'de', 'del', 'la', 'las', 'los', 'le', 'les', 'da', 'das', 'do', 'dos',
  'di', 'du', 'van', 'von', 'der', 'den', 'ter', 'ten', 'y', 'e',
])

function capitalizeSegment(segment: string): string {
  if (!segment) return segment
  const lower = segment.toLocaleLowerCase('es')
  return lower.charAt(0).toLocaleUpperCase('es') + lower.slice(1)
}

// Capitalizes each hyphen/apostrophe-separated piece of a word, e.g.
// "jean-pierre" -> "Jean-Pierre", "o'brien" -> "O'Brien".
function capitalizeWord(word: string): string {
  return word
    .split('-')
    .map((part) => part.split("'").map(capitalizeSegment).join("'"))
    .join('-')
}

// Normalizes free-text artist names that arrived with inconsistent
// casing — pasted in bulk from a spreadsheet (legacy_submissions) or typed
// by hand at /onboarding (profiles.name). This is a best-effort formatting
// pass, not a real name parser (it won't know "McDonald" from "Mcdonald"),
// so it's meant to be applied through an admin preview
// (components/admin/name-cleanup.tsx) that can skip a row instead of
// forcing every name through it. Case methods no-op on scripts without case
// (CJK, Arabic, ...), so non-Latin names just get their whitespace
// collapsed and pass through otherwise.
export function normalizeArtistName(name: string): string {
  const collapsed = name.trim().replace(/\s+/g, ' ')
  if (!collapsed) return collapsed

  return collapsed
    .split(' ')
    .map((word, index) => {
      if (index > 0 && LOWERCASE_PARTICLES.has(word.toLocaleLowerCase('es'))) {
        return word.toLocaleLowerCase('es')
      }
      return capitalizeWord(word)
    })
    .join(' ')
}
