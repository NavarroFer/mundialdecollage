// Public pages with an anonymous copy at app/[locale]/(site)/anon/<path> (see
// lib/render-mode.ts). proxy.ts sends visitors with nothing personal to it —
// built once per language, served from the CDN — and everyone else to the
// page itself, rendered per request as before. Both show the same thing to
// a visitor without a session, so nobody sees a difference.
//
// To add one: a page that reads no searchParams, cookies or headers beyond
// what renderAsAnonymous() answers (session, referral) and the locale. Give
// it an anon/ copy like the others; lib/static-pages.test.ts checks both.
// Plain module (no `@/` imports): proxy.ts loads it.
export const STATIC_PAGES = [
  '/',
  '/obras/[slug]',
  '/artistas/[slug]',
  '/galeria-3d',
  '/onboarding',
  '/partners',
  '/revista',
  '/politica-de-privacidad',
  '/terminos-y-condiciones',
] as const

const patterns = STATIC_PAGES.map(
  (page) => new RegExp(`^${page.replace(/\[[^\]]+\]/g, '[^/]+')}/?$`),
)

export function isStaticPage(pathname: string): boolean {
  return patterns.some((pattern) => pattern.test(pathname))
}
