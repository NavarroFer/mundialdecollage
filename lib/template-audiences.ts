// Who a mail template is for, to catalogue and filter them in
// /admin/plantillas. A template can have several. Values are stored in
// templates.audiences (see the migration's check constraint).
export const TEMPLATE_AUDIENCES = [
  { value: 'artistas', label: 'Artistas', description: 'Participan con al menos una obra.', className: 'bg-collage-blue/15 text-collage-blue' },
  { value: 'hinchas', label: 'Hinchas', description: 'Amigos y familia que dieron like o comentaron en la galería.', className: 'bg-collage-red/15 text-collage-red' },
  { value: 'interesados', label: 'Interesados', description: 'Todavía no participan: «Avisame» o en la lista sin obra.', className: 'bg-collage-yellow/25 text-ink' },
  { value: 'clientes', label: 'Clientes', description: 'Compraron en la tienda o están suscriptos al club.', className: 'border border-collage-blue/50 text-collage-blue' },
  { value: 'jurado', label: 'Jurado', description: 'Jurados invitados a evaluar.', className: 'border border-ink/30 text-ink' },
  { value: 'todos', label: 'Todos', description: 'Newsletter general a toda la lista.', className: 'bg-ink text-paper' },
] as const

export type TemplateAudience = (typeof TEMPLATE_AUDIENCES)[number]['value']

export function isTemplateAudience(value: unknown): value is TemplateAudience {
  return TEMPLATE_AUDIENCES.some((audience) => audience.value === value)
}

/** The valid, unique audiences among `values`, in catalogue order. */
export function parseAudiences(values: unknown[]): TemplateAudience[] {
  const picked = new Set(values.filter(isTemplateAudience))
  return TEMPLATE_AUDIENCES.map((a) => a.value).filter((value) => picked.has(value))
}

export const audienceMeta = (value: string) => TEMPLATE_AUDIENCES.find((a) => a.value === value)

// The template audiences that suit each campaign audience
// (lib/campaign-audience.ts), to suggest templates in the composer.
export const CAMPAIGN_TEMPLATE_AUDIENCES: Record<string, TemplateAudience[]> = {
  subscribed: ['todos'],
  no_artwork: ['hinchas', 'interesados'],
  not_participating: ['interesados', 'hinchas'],
  profile_review: ['artistas'],
  multiple_artworks: ['artistas'],
}
