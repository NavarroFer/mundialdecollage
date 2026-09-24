// Instagram arrives as "@handle", a bare handle or a profile link (the
// Registro sheet, /onboarding); profiles store the full URL. Our own account
// is never an artist's.
const OWN_HANDLES = new Set(['tehacefaltacollage_', 'tehacefaltacollage', 'mundialdecollage'])

export function instagramHandle(value: string | null | undefined): string | null {
  const handle = (value ?? '')
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@+/, '')
    .replace(/[/?#].*$/, '')
  if (!/^[A-Za-z0-9._]{3,30}$/.test(handle) || OWN_HANDLES.has(handle.toLowerCase())) return null
  return handle
}

export function instagramUrl(handle: string): string {
  return `https://instagram.com/${handle}`
}
