// Edit this file to update the deadline, contact email, or copy used across the site.
export const site = {
  name: 'Mundial Internacional de Collage',
  shortName: 'Mundial de Collage',
  tagline: 'Te hace falta collage',
  email: 'mundialdecollage@gmail.com',
  // TODO: add the real Instagram handle/URL once confirmed.
  instagram: '',
  // ISO date used by the countdown + "hasta el" copy. Update this if the deadline moves.
  deadlineISO: '2026-11-15T23:59:59-03:00',
  deadlineLabel: '15 de noviembre',
  // Bases del concurso (PDF). Drop the file at public/docs/bases-mundial-de-collage.pdf
  // and this link starts working — nothing else to change.
  basesPdfUrl: '/docs/bases-mundial-de-collage.pdf',
  workshop: {
    slogan: 'Ponete a practicar para el mundial',
    // Exact dates still tentative — keeping it a range until confirmed.
    dateLabel: 'Primeros días de octubre',
    // TODO: set once a price is decided; checkout (Mercado Pago) plugs in here later.
    priceLabel: 'Precio a confirmar',
  },
} as const
