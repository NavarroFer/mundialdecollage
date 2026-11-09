// What an artist's profile stores for its two optional links. Both are
// rendered straight into an <a href> on /obras/[slug] and /artistas/[slug],
// so this also doubles as XSS defense — only ever accept http(s), never
// javascript: or other schemes. Shared by the onboarding and the profile
// editor (/mi-perfil) so both accept exactly the same things.

// Stored as a full URL.
export function normalizeWebsite(value: string): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

// The form asks for a handle ("@tu.usuario"), not a URL, but it's rendered
// the same way as website — build the real profile URL here so both the
// link target and the XSS defense live in one place.
export function normalizeInstagram(value: string): string | null {
  if (!value) return null
  const handle = value
    .trim()
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/\/.*$/, '')
  return /^[a-zA-Z0-9._]{1,30}$/.test(handle) ? `https://instagram.com/${handle}` : null
}
