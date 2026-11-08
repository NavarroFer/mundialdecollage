// Liking or commenting on an artist's profile needs a Google session, like in
// the 3D gallery (lib/gallery-return.ts). A visitor without one is sent
// through Google with a return link to the artist's profile that says which
// obra and what they were doing; back on the profile (artist-feed.tsx) that
// obra reopens in its popup and the action finishes on its own — the like
// gets saved, the drafted comment gets sent.
//
// The profile page is static, so the link is read in the browser, never on
// the server (no searchParams in the page).
export type ProfileIntent = 'like' | 'comment'

export type ProfileReturn = { slug: string; intent: ProfileIntent }

const INTENTS: ProfileIntent[] = ['like', 'comment']
export const RETURN_PARAMS = ['obra', 'accion'] as const

/** `artistHref` is the profile's own path (/artistas/<slug>). */
export function profileReturnPath(artistHref: string, { slug, intent }: ProfileReturn): string {
  return `${artistHref}?${new URLSearchParams({ obra: slug, accion: intent })}`
}

export function readProfileReturn(search: string): ProfileReturn | null {
  const params = new URLSearchParams(search)
  const slug = params.get('obra')
  const intent = params.get('accion') as ProfileIntent | null
  if (!slug || slug.length > 300 || !intent || !INTENTS.includes(intent)) return null
  return { slug, intent }
}

/** The address without the return params, so a reload doesn't repeat the action. */
export function withoutReturnParams(search: string): string {
  const params = new URLSearchParams(search)
  for (const name of RETURN_PARAMS) params.delete(name)
  const rest = params.toString()
  return rest ? `?${rest}` : ''
}

// What the profile found in its address on arrival, until the popup of that
// obra picks it up. One-shot: the action runs once per return.
let pending: ProfileReturn | null = null

export function armProfileReturn(value: ProfileReturn | null) {
  pending = value
}

export function consumeProfileIntent(slug: string, intent: ProfileIntent): boolean {
  if (!pending || pending.slug !== slug || pending.intent !== intent) return false
  pending = null
  return true
}
