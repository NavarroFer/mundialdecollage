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

// Supabase keeps the session (and the PKCE verifier of a sign-in under way)
// in `sb-<project>-auth-token*` cookies.
function hasSupabaseSession(request: NextRequest) {
  return request.cookies.getAll().some(({ name }) => name.startsWith('sb-'))
}

// Refreshes the Supabase session cookie on every page request so server
// components see an up-to-date session. No-ops entirely until Supabase
// credentials exist, and for visitors who aren't signed in: with no session
// cookie there's nothing to refresh.
export async function proxy(request: NextRequest) {
  const languageRedirect = languageLinkRedirect(request)
  if (languageRedirect) return languageRedirect

  if (!isSupabaseConfigured || !hasSupabaseSession(request)) return NextResponse.next()

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

// Every match is a Function invocation billed for its CPU, so this skips what
// never reads the session: static files, the Clarity proxy (/monitoring), the
// link-preview images, and /api — the two routes there that do read it
// (track, stamps) refresh it themselves, as route handlers can set cookies.
export const config = {
  matcher: [
    '/((?!api/|monitoring/|_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image|.*/opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3|mp4|webm|pdf|glb|gltf|woff2?|ttf|txt|xml|webmanifest)$).*)',
  ],
}
