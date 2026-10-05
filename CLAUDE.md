@AGENTS.md

# Vercel CPU budget

The site runs on Vercel Hobby: 4 hours of Active CPU per 30 days for the whole team. Running out pauses the project until the window resets (or forces Pro). In October 2026 it was burning 40–55 min a day. Every change must keep CPU per visit low:

- Never draw an image (satori `ImageResponse`, sharp) per request: cache what it draws (`lib/share-image-cache.ts`, R2, or ISR). `lib/cost-guards.test.ts` lists the allowed renderers.
- A route that serves the same bytes to everyone sends `Cache-Control` with `s-maxage`, so the CDN answers instead of the Function. Check with `curl -D -` twice: `x-vercel-cache: HIT`.
- Don't use `force-dynamic` or request data (`cookies()`, `headers()`, session) in something that doesn't need it. Prefer `revalidate`.
- New routes that don't read the session stay out of the `proxy.ts` matcher (`proxy.test.ts`).
- Data the client can fetch later (lists, search, map) comes from a CDN-cached endpoint, not the server render.
- Pages live under `app/[locale]/(site)/`: `proxy.ts` rewrites every page request to `/<locale>/…` (the address bar never shows it). Public pages listed in `lib/static-pages.ts` also have an `anon/` copy, built ahead and served from the CDN to visitors with no session or referral. A component on such a page must read the session only through `getCurrentUser()` / `createClient()` (`lib/supabase/server.ts`) and the locale through `getI18n()`, never `cookies()`, `headers()` or `searchParams` directly, or the copy stops being static. After `next build`, the `anon` routes must show `●`, never `ƒ`.
- Every production deploy empties the CDN cache, and images and pages are then rebuilt on Functions. So commit locally and push to `main` in batches, once or twice a day or when the owner asks, never after every commit. Before pushing, check `git log origin/main..HEAD`: another session may be committing in the same repo.
