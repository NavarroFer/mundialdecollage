import { cache } from 'react'

// Public pages exist twice (lib/static-pages.ts): the page itself, rendered
// per request for whoever brings something personal (a session, a referral),
// and an `anon/` copy that renders it as a visitor with none of that would
// see it. The copy reads no cookies or headers, so it's built once and served
// from the CDN, and every visit doesn't cost a Function run (Vercel Hobby
// allows 4 hours of CPU a month, CLAUDE.md).
//
// The copy calls renderAsAnonymous() before rendering; the session and
// referral readers (lib/supabase/server.ts, lib/referral-server.ts) then
// answer «nobody» without touching cookies. Once per render, like React's
// cache() itself: route handlers and Server Actions always see a real request.
const mode = cache(() => ({ anonymous: false }))

export function renderAsAnonymous() {
  mode().anonymous = true
}

export function isAnonymousRender(): boolean {
  return mode().anonymous
}
