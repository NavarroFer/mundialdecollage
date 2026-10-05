import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { locale as localeParam } from 'next/root-params'
import { isLocale, LOCALE_COOKIE, resolveLocale, type Locale } from './locales'
import { MESSAGES } from './messages'

// Once per request. Pages read it from their URL: proxy.ts rewrites every
// page request to /<locale>/…, choosing it the same way as below, so a page
// can be built ahead and served from the CDN for each language. Route
// handlers and Server Actions have no such segment and resolve it again
// from the request: the reader's cookie choice, else their browser
// language, else the country Vercel geolocates them to (resolveLocale).
export const getLocale = cache(async (): Promise<Locale> => {
  try {
    const fromUrl = await localeParam()
    if (isLocale(fromUrl)) return fromUrl
  } catch {
    // Not in a page render: fall through to the request.
  }
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()])
  return resolveLocale({
    cookie: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerStore.get('accept-language'),
    country: headerStore.get('x-vercel-ip-country'),
  })
})

export async function getI18n() {
  const locale = await getLocale()
  return { locale, m: MESSAGES[locale] }
}
