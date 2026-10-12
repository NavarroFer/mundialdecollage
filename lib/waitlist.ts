// Where an «Avisame» form can live (components/waitlist-signup.tsx). Each one
// is its own funnel step (WAITLIST_EVENTS in lib/funnel.ts) and contacts
// source (aviso_<source>).
export const WAITLIST_SOURCES = ['footer', 'tienda', 'galeria', 'revista', 'plan_inicial', 'plan_miembro', 'plan_socio_premium'] as const

export type WaitlistSource = (typeof WAITLIST_SOURCES)[number]

// «Avisame cuando abra» on a membership plan that can't be bought yet.
export function planWaitlistSource(plan: 'inicial' | 'miembro' | 'socio-premium'): WaitlistSource {
  return `plan_${plan.replace('-', '_')}` as WaitlistSource
}
