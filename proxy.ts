import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { isLocale, LOCALE_COOKIE, resolveLocale } from '@/lib/i18n/locales'
import { parseReferral, REFERRAL_COOKIE } from '@/lib/referral'
import { isStaticPage } from '@/lib/static-pages'

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

// Where a page request is served from: every page lives under /<locale>/,
// and the public ones also have an anonymous copy under /<locale>/anon/
// that's built ahead and served from the CDN (lib/static-pages.ts). That
// copy is only for visitors bringing nothing it would have to read: no
// session, no artist's invitation (?ref= or its cookie). The address bar
// keeps the URL as typed.
function pageTarget(request: NextRequest): URL | null {
  const { pathname, searchParams } = request.nextUrl
  const segment = pathname.split('/')[1]
  const localized = isLocale(segment)
  const pagePath = localized ? pathname.slice(segment.length + 1) || '/' : pathname
  // Internal anonymous copies and localized handlers must keep their paths.
  if (localized && !isStaticPage(pagePath)) return null

  const locale = localized ? segment : resolveLocale({
    cookie: request.cookies.get(LOCALE_COOKIE)?.value,
    acceptLanguage: request.headers.get('accept-language'),
    country: request.headers.get('x-vercel-ip-country'),
  })
  // Only the home and obra pages render the server-side invitation. The
  // gallery reads it in the browser; other pages never read it. Keep the
  // cookie for attribution without disabling their CDN cache for 30 days.
  const showsInvite = pagePath === '/' || /^\/obras\/[^/]+\/?$/.test(pagePath)
  const referral = parseReferral(searchParams.get('ref')) ?? parseReferral(request.cookies.get(REFERRAL_COOKIE)?.value)
  const personal = hasSupabaseSession(request) || (showsInvite && referral !== null)
  if (localized && personal) return null
  const path = pagePath === '/' ? '' : pagePath
  const url = request.nextUrl.clone()
  url.pathname = !personal && isStaticPage(pagePath) ? `/${locale}/anon${path}` : `/${locale}${path}`
  return url
}

// Also refreshes the Supabase session cookie on every page request so
// server components see an up-to-date session — for visitors who are signed
// in: with no session cookie there's nothing to refresh.
export async function proxy(request: NextRequest) {
  const languageRedirect = languageLinkRedirect(request)
  if (languageRedirect) return languageRedirect

  const target = pageTarget(request)
  const pass = () => (target ? NextResponse.rewrite(target, { request }) : NextResponse.next({ request }))
  if (!isSupabaseConfigured || !hasSupabaseSession(request)) return pass()

  let response = pass()

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
          response = pass()
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
// isn't a page: static files, Next's own assets, the Clarity proxy
// (/monitoring), the link-preview images, and /api — the two routes there
// that read the session (track, stamps) refresh it themselves, as route
// handlers can set cookies.
export const config = {
  matcher: [
    '/((?!api/|monitoring/|_next/|_vercel/|__nextjs|favicon.ico|icon|apple-icon|opengraph-image|.*/opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|mp3|mp4|webm|pdf|glb|gltf|woff2?|ttf|txt|xml|json|webmanifest|js|css|map)$).*)',
  ],
}
