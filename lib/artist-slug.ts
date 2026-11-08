// Artist profile URLs, with no server imports, so the browser (the search box)
// builds the same /artistas links as the server does.
import { slugify } from '@/lib/slug'

const PROFILE_ID_SUFFIX = /([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i

/**
 * Builds a collision-free artist URL from fields that already exist. Keeping
 * the full profile id makes the route stable if the display name changes and
 * avoids adding a public-slug migration before launch.
 */
export function artistProfileSlug(name: string, profileId: string): string {
  return `${slugify(name) || 'artista'}-${profileId.toLowerCase()}`
}

export function artistProfileIdFromSlug(slug: string): string | undefined {
  return PROFILE_ID_SUFFIX.exec(slug)?.[1]?.toLowerCase()
}
