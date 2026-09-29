// Checks the /onboarding form runs in the browser, before anything is
// uploaded, so a fixable mistake never costs a round trip through
// completeOnboarding (app/onboarding/actions.ts) — on a phone that trip
// re-uploads the photo and lands the error at the top of a long form.
// Each cleaner returns what the form should submit: '' for an empty
// optional field, null when the value can't be fixed up.
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/onboarding-image'

// People arriving from Instagram paste their profile link from the app —
// "https://www.instagram.com/usuario?igsh=…", often without the https:// —
// which the server's normalizeInstagram rejects (the query string) or
// misreads (no scheme: it keeps "instagram.com" as the handle). A bare
// handle is the one shape it always accepts, so that's what gets sent.
// Same character rule as the server's, so nothing it accepts is refused here.
export function cleanInstagramInput(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const handle = trimmed
    .replace(/^(https?:\/\/)?((www|m)\.)?instagram\.com\//i, '')
    .replace(/^@+/, '')
    .replace(/[/?#].*$/, '')
  return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? handle : null
}

// Nobody types the https:// — the browser's own type="url" check used to
// block "misitio.com" with a message in the browser's language, not ours.
// Only http(s) with a dotted host gets through, same as the server's
// normalizeWebsite (which re-checks it anyway).
export function cleanWebsiteInput(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!url.hostname.includes('.')) return null
    return url.toString()
  } catch {
    return null
  }
}

// Checked as soon as a file is picked, so a HEIC photo or a huge scan is
// flagged next to its input instead of after tapping «Enviar».
export function imageProblem(file: { type: string; size: number }): 'invalid_image' | 'image_too_large' | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return 'invalid_image'
  if (file.size > MAX_IMAGE_BYTES) return 'image_too_large'
  return null
}
