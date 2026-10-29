import type { ClubHouse } from '@/lib/club-map'

// Where the Puerta al Club leads: another active gallery, one this browser
// has not been to first, so walking door to door goes round the whole Club
// before repeating. The visited list is a per-viewer convenience kept in
// localStorage; without it every gallery counts as new.

const VISITED_KEY = 'mdc-club-visited'
const MAX_REMEMBERED = 200

export function pickNextGallery(
  galleries: readonly ClubHouse[],
  currentSlug: string,
  visited: ReadonlySet<string>,
  random: () => number = Math.random,
): ClubHouse | null {
  const others = galleries.filter((gallery) => gallery.slug !== currentSlug)
  if (others.length === 0) return null
  const fresh = others.filter((gallery) => !visited.has(gallery.slug))
  const pool = fresh.length > 0 ? fresh : others
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
}

export function readVisitedGalleries(): Set<string> {
  try {
    const stored = JSON.parse(window.localStorage.getItem(VISITED_KEY) ?? '[]')
    return new Set(Array.isArray(stored) ? stored.filter((slug): slug is string => typeof slug === 'string') : [])
  } catch {
    return new Set()
  }
}

export function rememberVisitedGallery(slug: string) {
  try {
    const visited = [...readVisitedGalleries()].filter((stored) => stored !== slug)
    visited.push(slug)
    window.localStorage.setItem(VISITED_KEY, JSON.stringify(visited.slice(-MAX_REMEMBERED)))
  } catch {
    // Private windows and blocked storage: the door still works, only without memory.
  }
}
