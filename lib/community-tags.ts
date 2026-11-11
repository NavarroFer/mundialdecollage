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
