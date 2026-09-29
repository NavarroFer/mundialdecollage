// Every link an artist shares carries ?ref=<their obra's slug>, so whoever
// arrives through it is greeted as that artist's guest (ReferralInvite) and,
// if they go on to send their own obra, the sign-up is credited to the artist
// (completeOnboarding → public.referrals). Pure helpers, safe on both sides.

export const REFERRAL_PARAM = 'ref'

/** First-party cookie holding the obra that brought this visitor. */
export const REFERRAL_COOKIE = 'mdc-ref'
export const REFERRAL_MAX_AGE = 60 * 60 * 24 * 30

// What slugify() produces (lib/slug.ts), plus uniqueSlug's "-2" suffixes.
// Anything else in ?ref is someone playing with the URL, not a shared link.
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_LENGTH = 200

export function parseReferral(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > MAX_LENGTH) return null
  return SLUG_PATTERN.test(value) ? value : null
}

/** The same path, tagged as shared by the artist of `slug`. */
export function withReferral(path: string, slug: string): string {
  const [pathname, query = ''] = path.split('?')
  const params = new URLSearchParams(query)
  params.set(REFERRAL_PARAM, slug)
  return `${pathname}?${params}`
}

export function readReferralParam(search: string): string | null {
  return parseReferral(new URLSearchParams(search).get(REFERRAL_PARAM))
}

/** Reads mdc-ref out of a `document.cookie`-style string. */
export function readReferralCookie(cookies: string): string | null {
  const value = cookies
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${REFERRAL_COOKIE}=`))
    ?.slice(REFERRAL_COOKIE.length + 1)
  return parseReferral(value)
}
