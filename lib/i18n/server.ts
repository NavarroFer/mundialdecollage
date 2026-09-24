import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { LOCALE_COOKIE, resolveLocale, type Locale } from './locales'
import { MESSAGES } from './messages'

// Once per request: the reader's cookie choice, else their browser language,
// else the country Vercel geolocates them to (see resolveLocale).
export const getLocale = cache(async (): Promise<Locale> => {
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
