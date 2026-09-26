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

// The home's calls to action, recorded the same way so /admin/estadisticas
// can compare them against each other. home_view is the base the rest are
// measured against; the header's «Participar» sits on every page, not only
// the home.
export const HOME_EVENTS = [
  { name: 'home_view', label: 'Abrieron la home' },
  { name: 'submit_click_hero', label: 'Tocaron «Enviá tu obra» en la portada' },
  { name: 'submit_click_edition', label: 'Tocaron «Sumá tu obra» en la sección amarilla' },
  { name: 'submit_click_header', label: 'Tocaron «Participar» en el encabezado (cualquier página)' },
  { name: 'bases_download', label: 'Descargaron las bases' },
  { name: 'gallery_click_home', label: 'Fueron a la Galería 3D desde la sección de participantes' },
] as const

// Sharing an obra from its page, the home's «Ya estás participando» card or
// the confirmation after sending it (components/share-artwork.tsx).
export const SHARE_EVENTS = [
  { name: 'obra_share_click', label: 'Tocaron «Compartir»' },
  { name: 'obra_whatsapp_click', label: 'Compartieron por WhatsApp' },
  { name: 'obra_story_download', label: 'Bajaron la imagen para historias' },
] as const

export type FunnelEvent =
  | (typeof FUNNEL_STEPS)[number]['name']
  | (typeof HOME_EVENTS)[number]['name']
  | (typeof SHARE_EVENTS)[number]['name']

const NAMES = new Set<string>([...FUNNEL_STEPS, ...HOME_EVENTS, ...SHARE_EVENTS].map((step) => step.name))

export function isFunnelEvent(value: unknown): value is FunnelEvent {
  return typeof value === 'string' && NAMES.has(value)
}

/** First-party cookie holding the anonymous visitor id. */
export const VISITOR_COOKIE = 'mdc-vid'
export const VISITOR_ID_PATTERN = /^[a-zA-Z0-9-]{8,64}$/
