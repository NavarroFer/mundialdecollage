// Liking or commenting in the 3D gallery needs a Google session. When a
// visitor without one tries, the gallery sends them through Google with a
// return link that says which obra and what they were doing; back in the
// gallery (components/gallery/Game.tsx) that obra reopens and the action
// finishes on its own — the like gets saved, the drafted comment gets sent.
export type GalleryIntent = 'like' | 'comment'

export type GalleryReturn = { slug: string; intent: GalleryIntent }

const INTENTS: GalleryIntent[] = ['like', 'comment']

export function galleryReturnPath({ slug, intent }: GalleryReturn): string {
  return `/galeria-3d?${new URLSearchParams({ obra: slug, accion: intent })}`
}

/** Link that opens one obra in the gallery — to share, and in the museum mail. */
export function galleryArtworkPath(slug: string): string {
  return `/galeria-3d?${new URLSearchParams({ obra: slug })}`
}

/** The obra a shared link points at (no pending action attached). */
export function readSharedArtwork(search: string): string | null {
  const params = new URLSearchParams(search)
  const slug = params.get('obra')
  return slug && slug.length <= 300 && !params.has('accion') ? slug : null
}

export function readGalleryReturn(search: string): GalleryReturn | null {
  const params = new URLSearchParams(search)
  const slug = params.get('obra')
  const intent = params.get('accion') as GalleryIntent | null
  if (!slug || slug.length > 300 || !intent || !INTENTS.includes(intent)) return null
  return { slug, intent }
}

// The comment typed before signing in, kept for the round trip through
// Google (same tab, so sessionStorage survives it). Storage can be off or
// full — losing the draft then is acceptable, breaking the gallery isn't.
const draftKey = (slug: string) => `mdc-comment-draft:${slug}`

export function saveCommentDraft(slug: string, text: string) {
  try {
    if (text.trim()) sessionStorage.setItem(draftKey(slug), text)
    else sessionStorage.removeItem(draftKey(slug))
  } catch {}
}

export function readCommentDraft(slug: string): string {
  try {
    return sessionStorage.getItem(draftKey(slug)) ?? ''
  } catch {
    return ''
  }
}

export function clearCommentDraft(slug: string) {
  try {
    sessionStorage.removeItem(draftKey(slug))
  } catch {}
}
