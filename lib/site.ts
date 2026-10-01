// Edit this file to update the deadline, contact email, or copy used across the site.
export const site = {
  name: 'Mundial Internacional de Collage',
  shortName: 'Mundial de Collage',
  tagline: 'Te hace falta collage',
  email: 'mundialdecollage@gmail.com',
  // TODO: add the real Instagram handle/URL once confirmed.
  instagram: '',
  // Who runs the Mundial, credited in the footer. Brand names, not translated.
  organizers: [
    { name: 'Fersos', instagram: 'https://www.instagram.com/fersos.jpg' },
    { name: 'Te hace falta collage', instagram: 'https://www.instagram.com/tehacefaltacollage_/' },
  ],
  // ISO date used by the countdown + "hasta el" copy. Update this if the deadline moves.
  deadlineISO: '2026-11-15T23:59:59-03:00',
  deadlineLabel: '15 de noviembre',
  // Bases del concurso (PDF), servido desde public/mundial-de-collage.pdf.
  basesPdfUrl: '/mundial-de-collage.pdf',
  // Requires mundialdecollage.com.ar verified as a sending domain in Resend —
  // sends fail with a clear error until DNS propagates and verification completes.
  mailFrom: 'Mundial de Collage <hola@mundialdecollage.com.ar>',
  workshop: {
    slogan: 'Ponete a practicar para el mundial',
    // Exact dates still tentative — keeping it a range until confirmed.
    dateLabel: 'Primeros días de octubre',
    locationLabel: 'Mar del Plata, Argentina',
    // TODO: set once a price is decided; checkout (Mercado Pago) plugs in here later.
    priceLabel: 'Precio a confirmar',
    // Real ARS amounts. Until both are set, the registration flow stays
    // disabled and the site keeps showing priceLabel above instead.
    totalPrice: null as number | null,
    minDeposit: null as number | null,
    capacity: 20,
  },
  // How many obras an artist can postulate. One is free; a one-time payment
  // raises it to paidLimit. maxStored caps how many obras one account can
  // upload at all (they can keep several and choose), so storage can't be
  // filled without limit. See lib/entries.ts.
  entries: {
    freeLimit: 1,
    paidLimit: 5,
    maxStored: 10,
    priceArs: 30000,
    priceUsd: 15,
  },
  // Preventa de la Revista 1ª Edición (app/revista). Printed only, shipped
  // worldwide. priceArs is per copy with shipping in Argentina; until
  // it's set, /revista collects emails («Avisame») instead of selling.
  magazine: {
    priceArs: null as number | null,
    // Added once per order shipped outside Argentina. While null, the form
    // only ships within Argentina and asks buyers abroad to write.
    shippingAbroadArs: null as number | null,
    maxQuantity: 5,
    // Publication day, shown on /revista in the reader's language.
    releaseISO: '2026-12-10T12:00:00-03:00',
  },
  // Participation certificates (lib/certificate.tsx): a printable diploma
  // and an Instagram image per obra. While enabled is false only admins can
  // open them (preview from /admin/obras); flip it to hand them out.
  certificates: {
    enabled: false,
    // The date printed on every certificate.
    issuedISO: '2026-11-16T12:00:00-03:00',
  },
} as const

export function isMagazineSaleOpen() {
  return site.magazine.priceArs !== null
}

export function isWorkshopPaymentConfigured() {
  return site.workshop.totalPrice !== null && site.workshop.minDeposit !== null
}

// Prefer an explicit override, then Vercel's own assigned domain for this
// deployment, falling back to localhost for `next dev`.
export function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL
  if (vercelUrl) return `https://${vercelUrl}`
  return 'http://localhost:3000'
}
