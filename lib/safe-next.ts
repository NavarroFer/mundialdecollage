// Only paths on this site: gluing an arbitrary `next` onto the origin let
// "?next=@evil.com" send a freshly signed-in visitor to another host.
export function safeNextUrl(next: string | null, origin: string): string {
  const fallback = `${origin}/onboarding`
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback
  try {
    const url = new URL(next, origin)
    return url.origin === origin ? url.toString() : fallback
  } catch {
    return fallback
  }
}
