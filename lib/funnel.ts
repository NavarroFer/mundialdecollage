// The steps of the gallery → sign-in → home → sign-up circuit, in order, as
// /admin/estadisticas shows them. Each is recorded once per occurrence in
// funnel_events (supabase/migrations/20260925160000_engagement.sql) with an
// anonymous per-browser id — no names or emails — so the admin can see
// where people drop off before building the monthly plan on top of it.
export const FUNNEL_STEPS = [
  { name: 'gallery_view', label: 'Abrieron la galería' },
  { name: 'shared_link_open', label: 'Llegaron por el link de una obra (compartido o del mail)' },
  { name: 'gallery_enter', label: 'Entraron a recorrerla' },
  { name: 'artwork_open', label: 'Abrieron una obra' },
  { name: 'like_click', label: 'Tocaron «Me gusta»' },
  { name: 'sign_in_start', label: 'Fueron a ingresar con Google' },
  { name: 'sign_in_return', label: 'Volvieron logueados a la obra' },
  { name: 'like_saved', label: 'Dejaron un like' },
  { name: 'comment_sent', label: 'Escribieron un comentario' },
  { name: 'share_click', label: 'Compartieron una obra' },
  { name: 'home_from_gallery', label: 'Fueron de la galería al inicio' },
  { name: 'signup_prompt_view', label: 'Vieron «Terminá tu inscripción» o «Confirmá tus datos»' },
  { name: 'signup_prompt_click', label: 'Tocaron para terminar o confirmar' },
  { name: 'signup_done', label: 'Terminaron o confirmaron la inscripción' },
] as const

export type FunnelEvent = (typeof FUNNEL_STEPS)[number]['name']

const NAMES = new Set<string>(FUNNEL_STEPS.map((step) => step.name))

export function isFunnelEvent(value: unknown): value is FunnelEvent {
  return typeof value === 'string' && NAMES.has(value)
}

/** First-party cookie holding the anonymous visitor id. */
export const VISITOR_COOKIE = 'mdc-vid'
export const VISITOR_ID_PATTERN = /^[a-zA-Z0-9-]{8,64}$/
