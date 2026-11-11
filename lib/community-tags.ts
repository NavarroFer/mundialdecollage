// Fixed vocabulary for Comunidad (docs/red-social.md §11 ter). Ids, not free
// text, so two posts can be compared and the labels can be translated later.

export const COMMUNITY_TAGS = [
  'analogico', 'digital', 'mixto',
  'retrato', 'autorretrato', 'cuerpo', 'naturaleza', 'ciudad', 'politica', 'humor',
  'surreal', 'abstracto', 'tipografia', 'texto', 'geometria',
  'blanco-negro', 'colores-vivos', 'tonos-tierra', 'rojo', 'azul',
  'intimo', 'ludico', 'oscuro', 'luz', 'noche',
  'obra-terminada', 'proceso', 'taller', 'materiales', 'papel', 'recorte', 'textura',
  'mar', 'memoria', 'viaje', 'casa', 'infancia', 'animales', 'objeto', 'serie',
] as const

export type CommunityTag = (typeof COMMUNITY_TAGS)[number]

const ALLOWED = new Set<string>(COMMUNITY_TAGS)

const INDEX = new Map<string, number>(COMMUNITY_TAGS.map((tag, index) => [tag, index]))

/**
 * Tags travel as indexes into COMMUNITY_TAGS in the cached listing: a few
 * numbers instead of repeated strings keep /api/obras small.
 */
export function tagIndexes(tags: string[] | null | undefined): number[] {
  if (!tags?.length) return []
  const seen = new Set<number>()
  for (const tag of tags) {
    const index = INDEX.get(tag.trim().toLowerCase())
    if (index !== undefined) seen.add(index)
  }
  return [...seen].sort((a, b) => a - b)
}

/** The tags behind the indexes sent by /api/obras. Unknown indexes are dropped. */
export function tagsFromIndexes(indexes: number[] | null | undefined): CommunityTag[] {
  if (!indexes?.length) return []
  const tags: CommunityTag[] = []
  for (const index of indexes) {
    const tag = COMMUNITY_TAGS[index]
    if (tag && !tags.includes(tag)) tags.push(tag)
  }
  return tags
}

/** Keeps only known tags, at most six, in first-seen order. */
export function cleanTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string') continue
    const tag = item.trim().toLowerCase()
    if (!ALLOWED.has(tag) || seen.has(tag)) continue
    seen.add(tag)
    if (seen.size === 6) break
  }
  return [...seen]
}
