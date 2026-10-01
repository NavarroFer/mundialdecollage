// Where an «Avisame» form can live (components/waitlist-signup.tsx). Each one
// is its own funnel step (WAITLIST_EVENTS in lib/funnel.ts) and contacts
// source (aviso_<source>).
export const WAITLIST_SOURCES = ['footer', 'tienda', 'galeria', 'revista'] as const

export type WaitlistSource = (typeof WAITLIST_SOURCES)[number]
