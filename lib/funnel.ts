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
  { name: 'submit_click_bases', label: 'Tocaron «Enviá tu obra» junto a las bases' },
  { name: 'submit_click_edition', label: 'Tocaron «Sumá tu obra» en la sección amarilla' },
  { name: 'submit_click_header', label: 'Tocaron «Participar» en el encabezado (cualquier página)' },
  { name: 'submit_click_tabbar', label: 'Tocaron «Participar» en la barra de abajo del celular (cualquier página)' },
  { name: 'bases_download', label: 'Descargaron las bases' },
  { name: 'gallery_click_hero', label: 'Fueron a la Galería 3D desde el hero' },
  { name: 'gallery_click_home', label: 'Fueron a la Galería 3D desde la sección de participantes' },
  { name: 'gallery_click_tabbar', label: 'Fueron a la Galería 3D desde la barra de abajo del celular' },
] as const

// Sharing an obra from its page, the home's «Ya estás participando» card or
// the confirmation after sending it (components/share-artwork.tsx).
export const SHARE_EVENTS = [
  { name: 'obra_share_click', label: 'Tocaron «Compartir»' },
  { name: 'obra_whatsapp_click', label: 'Compartieron por WhatsApp' },
  { name: 'obra_story_download', label: 'Bajaron la imagen para historias' },
  { name: 'obra_link_copied', label: 'Copiaron el enlace de una obra' },
  { name: 'obra_share_handoff', label: 'Completaron el menú de compartir de una obra (no confirma publicación)' },
  { name: 'gallery_whatsapp_click', label: 'Abrieron WhatsApp para compartir desde la galería' },
  { name: 'gallery_link_copied', label: 'Copiaron un enlace desde la galería' },
  { name: 'gallery_share_handoff', label: 'Completaron el menú de compartir de la galería (no confirma publicación)' },
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
  { name: 'file_picker_open', label: 'Abrieron el selector de imagen' },
  { name: 'onboarding_image_selected', label: 'Eligieron la imagen de su obra' },
  { name: 'onboarding_submit', label: 'Tocaron «Enviar»' },
] as const

// Side branches of the same form: what was typed coming back after the
// page reloaded (Instagram's browser does it around the file picker), and
// the form sent back with an error.
export const FORM_RESCUE_EVENTS = [
  { name: 'form_restored', label: 'Recuperaron lo que habían escrito al volver a la página' },
  { name: 'onboarding_error', label: 'Volvieron al formulario con un error' },
] as const

// Every «Ingresar con Google», wherever it is (components/auth/google-sign-in-button.tsx):
// the tap, a return with a session (app/[locale]/(site)/auth/callback) and
// a failure on either side.
export const LOGIN_EVENTS = [
  { name: 'login_google_click', label: 'Tocaron «Ingresar con Google»' },
  { name: 'login_google_return_ok', label: 'Volvieron de Google con la sesión iniciada' },
  { name: 'login_google_error', label: 'El ingreso con Google falló' },
] as const

// Each sign-up by where its artist first came from (lib/visit-source.ts).
export const SIGNUP_SOURCE_EVENTS = [
  { name: 'signup_source_instagram', label: 'Llegaron por Instagram' },
  { name: 'signup_source_facebook', label: 'Llegaron por Facebook' },
  { name: 'signup_source_artist', label: 'Llegaron por el link de un artista' },
  { name: 'signup_source_google', label: 'Llegaron desde Google' },
  { name: 'signup_source_email', label: 'Llegaron por un mail' },
  { name: 'signup_source_direct', label: 'Entraron directo o desde una app sin origen' },
  { name: 'signup_source_other', label: 'Llegaron desde otro sitio' },
] as const

// How long the Galería 3D took from opening to ready to walk (Game.tsx).
// Names can't carry digits (funnel_events.name), hence words for the ranges.
export const GALLERY_READY_EVENTS = [
  { name: 'gallery_ready_fast', label: 'Lista en menos de 3 segundos' },
  { name: 'gallery_ready_ok', label: 'Lista en 3 a 8 segundos' },
  { name: 'gallery_ready_slow', label: 'Lista en 8 a 20 segundos' },
  { name: 'gallery_ready_very_slow', label: 'Lista en más de 20 segundos' },
] as const

export function galleryReadyEvent(ms: number): (typeof GALLERY_READY_EVENTS)[number]['name'] {
  if (ms < 3000) return 'gallery_ready_fast'
  if (ms < 8000) return 'gallery_ready_ok'
  if (ms < 20000) return 'gallery_ready_slow'
  return 'gallery_ready_very_slow'
}

// Public artwork and artist pages turn discovery and shared traffic into a
// path back to the artist and, from there, into a new free submission.
export const DISCOVERY_EVENTS = [
  { name: 'artwork_page_view', label: 'Abrieron la página pública de una obra' },
  { name: 'artwork_next_click', label: 'Descubrieron otra obra desde las tarjetas de navegación' },
  { name: 'surprise_click_artwork', label: 'Tocaron «Sorprendeme» desde una obra' },
  { name: 'artwork_artist_profile_click', label: 'Fueron de una obra al perfil de su artista' },
  { name: 'artwork_participate_click', label: 'Fueron de una obra a participar' },
  { name: 'artist_profile_view', label: 'Abrieron un perfil público de artista' },
  { name: 'artist_profile_participate_click', label: 'Fueron de un perfil de artista a participar' },
] as const

// The store's own path, from opening /tienda to PayPal approving the
// subscription, to see where a sale gets lost.
export const STORE_FUNNEL_EVENTS = [
  { name: 'store_view', label: 'Abrieron la tienda' },
  { name: 'shipping_branch_selected', label: 'Eligieron una sucursal de retiro' },
  { name: 'shipping_search_empty', label: 'Búsquedas de sucursal sin resultados' },
  { name: 'shipping_search_failed', label: 'Falló la búsqueda de sucursales' },
  { name: 'store_checkout_open', label: 'Tocaron «Suscribirme» en un plan' },
  { name: 'store_checkout_start', label: 'Revisaron sus datos y empezaron el pago' },
  { name: 'store_checkout_approved', label: 'Se autorizó la suscripción' },
] as const

// Where the people who reach the store come from.
export const STORE_ENTRY_EVENTS = [
  { name: 'store_click_home_membership', label: 'Fueron a la membresía desde la home' },
  { name: 'store_click_home_cutouts', label: 'Fueron a los recortes desde la home' },
  { name: 'store_click_header', label: 'Fueron a la tienda desde el encabezado' },
  { name: 'store_click_tabbar', label: 'Fueron a la tienda desde la barra de abajo del celular' },
  { name: 'store_click_artwork', label: 'Fueron a la tienda desde la página de una obra' },
  { name: 'store_click_confirmation', label: 'Fueron a la tienda después de inscribirse' },
  { name: 'store_from_email', label: 'Llegaron a la tienda desde el mail diario' },
] as const

// «Avisame»: visitors who aren't artists leave their email to hear about
// the finalists and the magazine (app/aviso/actions.ts → contacts).
export const WAITLIST_EVENTS = [
  { name: 'waitlist_signup_footer', label: 'Dejaron su mail en el pie de página' },
  { name: 'waitlist_signup_tienda', label: 'Dejaron su mail en la tienda' },
  { name: 'waitlist_signup_galeria', label: 'Pidieron el aviso después de un like o comentario' },
  { name: 'waitlist_signup_revista', label: 'Pidieron el aviso de la preventa de la revista' },
  { name: 'waitlist_signup_plan_inicial', label: 'Pidieron «Avisame cuando abra» en el plan Inicial' },
  { name: 'waitlist_signup_plan_miembro', label: 'Pidieron «Avisame cuando abra» en el plan Miembro' },
  { name: 'waitlist_signup_plan_socio_premium', label: 'Pidieron «Avisame cuando abra» en el plan Socio Premium' },
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

// Donations (lib/donations.ts): who goes to Mercado Pago to give, from the
// home or the gallery, and who comes back to /donar/gracias (paid, or a cash
// payment still to be made).
export const DONATION_EVENTS = [
  { name: 'donation_checkout_start_home', label: 'Fueron a donar desde la home' },
  { name: 'donation_checkout_start_gallery', label: 'Fueron a donar desde la galería 3D' },
  { name: 'donation_thanks_view', label: 'Volvieron de Mercado Pago a «Gracias por donar»' },
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
  | (typeof ONBOARDING_FORM_EVENTS)[number]['name']
  | (typeof FORM_RESCUE_EVENTS)[number]['name']
  | (typeof LOGIN_EVENTS)[number]['name']
  | (typeof SIGNUP_SOURCE_EVENTS)[number]['name']
  | (typeof GALLERY_READY_EVENTS)[number]['name']
  | (typeof DISCOVERY_EVENTS)[number]['name']
  | (typeof STORE_FUNNEL_EVENTS)[number]['name']
  | (typeof STORE_ENTRY_EVENTS)[number]['name']
  | (typeof WAITLIST_EVENTS)[number]['name']
  | (typeof MAGAZINE_FUNNEL_EVENTS)[number]['name']
  | (typeof MAGAZINE_ENTRY_EVENTS)[number]['name']
  | (typeof PARTNER_EVENTS)[number]['name']
  | (typeof DONATION_EVENTS)[number]['name']

const NAMES = new Set<string>(
  [
    ...FUNNEL_STEPS, ...HOME_EVENTS, ...SHARE_EVENTS, ...SOUVENIR_EVENTS, ...WALL_EVENTS, ...INVITE_EVENTS, ...REFERRAL_EVENTS, ...ONBOARDING_EVENTS, ...DISCOVERY_EVENTS,
    ...ONBOARDING_FORM_EVENTS, ...FORM_RESCUE_EVENTS, ...LOGIN_EVENTS, ...SIGNUP_SOURCE_EVENTS, ...GALLERY_READY_EVENTS,
    ...STORE_FUNNEL_EVENTS, ...STORE_ENTRY_EVENTS, ...WAITLIST_EVENTS, ...MAGAZINE_FUNNEL_EVENTS, ...MAGAZINE_ENTRY_EVENTS, ...PARTNER_EVENTS, ...DONATION_EVENTS,
  ].map((step) => step.name),
)

export const FUNNEL_EVENT_NAMES: readonly string[] = [...NAMES]

export function isFunnelEvent(value: unknown): value is FunnelEvent {
  return typeof value === 'string' && NAMES.has(value)
}

/** First-party cookie holding the anonymous visitor id. */
export const VISITOR_COOKIE = 'mdc-vid'
export const VISITOR_ID_PATTERN = /^[a-zA-Z0-9-]{8,64}$/

/** Most steps one /api/track call carries (lib/track.ts sends them in batches). */
export const TRACK_BATCH_MAX = 20
