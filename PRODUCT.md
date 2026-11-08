# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: adult collage artists (30+) from many countries. They enter an artwork in the open call, then come back to see it hung in the gallery, share their artist profile, and follow the edition (finalists, jury, magazine).

Secondary: the art-loving public who walk the 3D gallery and browse artworks, and brands that sponsor the event (/partners). Donors overlap with both groups.

The 3D gallery cast has no children, to match this audience.

## Product Purpose

The Mundial Internacional de Collage is an international collage competition and archive. Each edition runs an open call, shows every received artwork in a walkable 3D gallery and on its own page, and builds up an international jury and finalists. Success means artists from many countries take part, share their profiles, and come back, and each edition stays online as a permanent archive.

## Positioning

- **International scale:** a "world cup" of collage, with artists from many countries. The map, the flags and the per-country counts prove it with real data.
- **A walkable 3D gallery:** visitors walk the show instead of scrolling a grid. Club artists can pay for their own 3D gallery that stays open every day.
- **Self-run and analog:** an independent project funded by donations. It ships paper by post (the store, the magazine) and grows a collage community.
- **A permanent archive:** every edition stays online, with one page per artwork and per artist.

## Operating Context

- Artists sign in with Google, go through onboarding, upload their artwork, and get mails that link to their own profile.
- Visitors arrive from Instagram and WhatsApp shares, often inside in-app browsers on their phones.
- Payments go through Mercado Pago (pesos) and PayPal (dollars). Donations, the paper store and Club memberships all use them.
- Admins curate the imported data, the jury, mail campaigns and stats in /admin.

## Capabilities and Constraints

- **Real data only:** counts, rankings, the map and stats come from Supabase live. Never write invented numbers, testimonials or hard-coded snapshots.
- **Low CPU cost:** the site runs on Vercel Hobby with a 4 h/month Active CPU budget. Public pages are served from the CDN, and nothing renders per request when it can be cached (see CLAUDE.md).
- **Multilingual:** every page shows in the visitor's language, with Spanish as the base locale. Legal pages stay in Spanish.
- **Open call status:** this edition no longer accepts artworks. The site now leads to the gallery and to the finalists.

## Brand Commitments

- Fixed identity from the September 2026 brand guide: the paper, ink, blue, red and ochre palette, and torn-paper collage as the main motif. Visual work extends this identity and does not replace it.
- The voice is Rioplatense Spanish (voseo) in the Spanish copy.

## Evidence on Hand

- Real artworks, artists, countries and counts, all in Supabase.
- The brand guide, from September 2026.
- The bases (rules) PDF, in `docs/bases/`.
- Sponsorship material, in `docs/patrocinio/`.

There are no jury names or finalists until they are confirmed. Never fabricate them.

## Product Principles

1. The Mundial earns its prestige first. Secondary offers like workshops and the store never lead the home.
2. Every number on screen is real and computed from the data.
3. The artwork leads. The interface serves showing, finding and sharing it.
4. Every page has to work on a phone inside Instagram's browser.
5. Every feature costs as little server CPU as possible.

## Accessibility & Inclusion

The target is WCAG 2.1 AA. The audience is adults over 30, so text stays legible: body and placeholder text at 4.5:1 or more, and functional labels at 12px or more. Motion respects `prefers-reduced-motion`.
