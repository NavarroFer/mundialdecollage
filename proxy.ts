import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { isLocale, LOCALE_COOKIE } from '@/lib/i18n/locales'

// `?lang=it` links (for sharing the site in a given language) store that
// choice like the language switcher does, then drop the param from the URL.
function languageLinkRedirect(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get('lang')
  if (!isLocale(lang)) return null
  const url = request.nextUrl.clone()
  url.searchParams.delete('lang')
  const response = NextResponse.redirect(url)
  response.cookies.set(LOCALE_COOKIE, lang, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  return response
}

// Refreshes the Supabase session cookie on every request so server components
// see an up-to-date session. No-ops entirely until Supabase credentials exist.
export async function proxy(request: NextRequest) {
  const languageRedirect = languageLinkRedirect(request)
  if (languageRedirect) return languageRedirect

  if (!isSupabaseConfigured) return NextResponse.next()

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
