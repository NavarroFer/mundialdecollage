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
  { name: 'artwork_stamp_saved', label: 'Guardaron una estampilla de obra' },
  { name: 'comment_sent', label: 'Escribieron un comentario' },
  { name: 'share_click', label: 'Compartieron una obra' },
  { name: 'home_from_gallery', label: 'Fueron de la galería al inicio' },
  { name: 'signup_prompt_view', label: 'Vieron «Terminá tu inscripción» o «Confirmá tus datos»' },
  { name: 'signup_prompt_click', label: 'Tocaron para terminar o confirmar' },
  { name: 'signup_done', label: 'Terminaron o confirmaron la inscripción' },
] as const

// The main, linear gallery experience. Shared links, likes, comments and
// sign-in are entry sources or optional branches, so they belong in their
// own comparisons rather than making the central exploration funnel grow.
export const GALLERY_HAPPY_PATH = [
  { name: 'gallery_view', label: 'Abrieron la galería' },
  { name: 'gallery_enter', label: 'Entraron a recorrerla' },
  { name: 'artwork_open', label: 'Abrieron una obra' },
] as const

// The home's calls to action, recorded the same way so /admin/estadisticas
// can compare them against each other. home_view is the base the rest are
// measured against; the header's «Participar» sits on every page, not only
// the home.
export const HOME_EVENTS = [
  { name: 'home_view', label: 'Abrieron la home' },
  { name: 'hero_cta_view', label: 'Vieron «Enviá tu obra» en la portada' },
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

// The souvenir photo from the 3D gallery (components/gallery/ui/Souvenir.tsx):
// a story image of what the visitor was looking at.
export const SOUVENIR_EVENTS = [
  { name: 'souvenir_photo', label: 'Sacaron una foto en la galería' },
  { name: 'souvenir_share', label: 'La compartieron' },
  { name: 'souvenir_download', label: 'La descargaron' },
] as const

// The collective collage on Room 1's end wall (components/gallery/wall).
export const WALL_EVENTS = [
  { name: 'wall_open', label: 'Abrieron el collage colectivo (E frente al cuadro)' },
  { name: 'wall_sign_in', label: 'Fueron a ingresar con Google para pegar' },
  { name: 'wall_piece_placed', label: 'Pegaron una foto' },
  { name: 'wall_no_lives', label: 'Intentaron pegar sin vidas' },
] as const

// Someone who just liked or commented an obra (mostly friends of the artist
// who shared it) is invited, right there, to send their own.
export const INVITE_EVENTS = [
  { name: 'artist_invite_view', label: 'Vieron «¿Vos también hacés collage?» después de un like o comentario' },
  { name: 'artist_invite_click', label: 'Tocaron para mandar su obra desde esa invitación' },
] as const

// Links shared by an artist carry ?ref=<their obra>, so whoever arrives
// through one is greeted as that artist's guest and their sign-up is
// credited to them.
export const REFERRAL_EVENTS = [
  { name: 'referral_open', label: 'Llegaron por el link de un artista (con su invitación)' },
  { name: 'referral_invite_click', label: 'Tocaron «Sumá tu obra» en la invitación del artista' },
  { name: 'referral_signup', label: 'Se inscribieron invitados por un artista' },
] as const

// The steps inside /onboarding, between «Enviá tu obra» and a finished
// sign-up, to see where people give up.
export const ONBOARDING_EVENTS = [
  { name: 'onboarding_signin_view', label: 'Vieron «Entrá con Google» en la inscripción' },
  { name: 'onboarding_signin_click', label: 'Tocaron «Entrar con Google» en la inscripción' },
  { name: 'onboarding_form_view', label: 'Vieron el formulario de la obra' },
  { name: 'onboarding_image_selected', label: 'Eligieron la imagen de su obra' },
  { name: 'onboarding_submit', label: 'Tocaron «Enviar»' },
  { name: 'onboarding_error', label: 'Volvieron al formulario con un error' },
  { name: 'signup_done', label: 'Terminaron o confirmaron la inscripción' },
] as const

// The actual, linear form flow. Sign-in happens before this form, the error
// event is a side branch, and signup_done can be reached through other
// journeys; including any of those in a funnel would create false increases.
export const ONBOARDING_FORM_EVENTS = [
  { name: 'onboarding_form_view', label: 'Vieron el formulario de la obra' },
  { name: 'onboarding_image_selected', label: 'Eligieron la imagen de su obra' },
  { name: 'onboarding_submit', label: 'Tocaron «Enviar»' },
] as const

// Public artwork and artist pages turn discovery and shared traffic into a
// path back to the artist and, from there, into a new free submission.
export const DISCOVERY_EVENTS = [
  { name: 'artwork_page_view', label: 'Abrieron la página pública de una obra' },
  { name: 'artwork_artist_profile_click', label: 'Fueron de una obra al perfil de su artista' },
  { name: 'artwork_participate_click', label: 'Fueron de una obra a participar' },
  { name: 'artist_profile_view', label: 'Abrieron un perfil público de artista' },
  { name: 'artist_profile_participate_click', label: 'Fueron de un perfil de artista a participar' },
] as const

// The store's own path, from opening /tienda to PayPal approving the
// subscription, to see where a sale gets lost.
export const STORE_FUNNEL_EVENTS = [
  { name: 'store_view', label: 'Abrieron la tienda' },
  { name: 'store_checkout_open', label: 'Tocaron «Suscribirme» en un plan' },
  { name: 'store_checkout_start', label: 'Completaron sus datos y abrieron PayPal' },
  { name: 'store_checkout_approved', label: 'PayPal aprobó la suscripción' },
] as const

// Where the people who reach the store come from.
export const STORE_ENTRY_EVENTS = [
  { name: 'store_click_header', label: 'Fueron a la tienda desde el encabezado' },
  { name: 'store_click_artwork', label: 'Fueron a la tienda desde la página de una obra' },
  { name: 'store_from_email', label: 'Llegaron a la tienda desde el mail diario' },
] as const

// «Avisame»: visitors who aren't artists leave their email to hear about
// the finalists and the magazine (app/aviso/actions.ts → contacts).
export const WAITLIST_EVENTS = [
  { name: 'waitlist_signup_footer', label: 'Dejaron su mail en el pie de página' },
  { name: 'waitlist_signup_tienda', label: 'Dejaron su mail en la tienda' },
  { name: 'waitlist_signup_galeria', label: 'Pidieron el aviso después de un like o comentario' },
  { name: 'waitlist_signup_revista', label: 'Pidieron el aviso de la preventa de la revista' },
] as const

// Preventa de la Revista 1ª Edición (app/revista), from the page to a
// Mercado Pago payment.
export const MAGAZINE_FUNNEL_EVENTS = [
  { name: 'magazine_view', label: 'Abrieron la página de la revista' },
  { name: 'magazine_checkout_start', label: 'Completaron el envío y fueron a Mercado Pago' },
  { name: 'magazine_paid', label: 'Pagaron la revista' },
] as const

// Where the people who reach /revista come from.
export const MAGAZINE_ENTRY_EVENTS = [
  { name: 'magazine_click_store', label: 'Fueron a la revista desde la tienda' },
  { name: 'magazine_click_confirmation', label: 'Fueron a la revista después de inscribirse' },
  { name: 'magazine_click_status', label: 'Fueron a la revista desde «Ya estás participando»' },
] as const

// Brands interested in being partners (app/partners): where they reach the
// page from, and who goes on to write to site.email.
export const PARTNER_EVENTS = [
  { name: 'partners_view', label: 'Abrieron la página de partners' },
  { name: 'partners_click_footer', label: 'Fueron a partners desde el pie de página' },
  { name: 'partners_click_magazine', label: 'Fueron a partners desde la revista' },
  { name: 'partners_click_gallery', label: 'Fueron a partners desde la galería 3D' },
  { name: 'partners_email_click', label: 'Tocaron el mail para escribirnos' },
] as const

export type FunnelEvent =
  | (typeof FUNNEL_STEPS)[number]['name']
  | (typeof HOME_EVENTS)[number]['name']
  | (typeof SHARE_EVENTS)[number]['name']
  | (typeof SOUVENIR_EVENTS)[number]['name']
  | (typeof WALL_EVENTS)[number]['name']
  | (typeof INVITE_EVENTS)[number]['name']
  | (typeof REFERRAL_EVENTS)[number]['name']
  | (typeof ONBOARDING_EVENTS)[number]['name']
  | (typeof DISCOVERY_EVENTS)[number]['name']
  | (typeof STORE_FUNNEL_EVENTS)[number]['name']
  | (typeof STORE_ENTRY_EVENTS)[number]['name']
  | (typeof WAITLIST_EVENTS)[number]['name']
  | (typeof MAGAZINE_FUNNEL_EVENTS)[number]['name']
  | (typeof MAGAZINE_ENTRY_EVENTS)[number]['name']
  | (typeof PARTNER_EVENTS)[number]['name']

const NAMES = new Set<string>(
  [
    ...FUNNEL_STEPS, ...HOME_EVENTS, ...SHARE_EVENTS, ...SOUVENIR_EVENTS, ...WALL_EVENTS, ...INVITE_EVENTS, ...REFERRAL_EVENTS, ...ONBOARDING_EVENTS, ...DISCOVERY_EVENTS,
    ...STORE_FUNNEL_EVENTS, ...STORE_ENTRY_EVENTS, ...WAITLIST_EVENTS, ...MAGAZINE_FUNNEL_EVENTS, ...MAGAZINE_ENTRY_EVENTS, ...PARTNER_EVENTS,
  ].map((step) => step.name),
)

export function isFunnelEvent(value: unknown): value is FunnelEvent {
  return typeof value === 'string' && NAMES.has(value)
}

/** First-party cookie holding the anonymous visitor id. */
export const VISITOR_COOKIE = 'mdc-vid'
export const VISITOR_ID_PATTERN = /^[a-zA-Z0-9-]{8,64}$/
