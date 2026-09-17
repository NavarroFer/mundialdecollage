// Add one entry per confirmed finalist once the Mundial announces them. slug
// feeds the individual work page route (/obras/[slug]) — keep it URL-safe
// (lowercase, hyphens). countryCode is the 2-letter ISO code (AR, MX, ES,
// US, ...) used to render the flag + country name. instagram/website are
// optional and should only be filled in when the artist authorizes sharing
// them (ver ROADMAP.md, sección "Primera Edición").
export type Finalist = {
  slug: string
  name: string
  countryCode: string
  artworkTitle: string
  technique: string
  imageUrl: string
  instagram?: string
  website?: string
}

// DEMO mock data — for showing the design with sample data. Remove before
// launch (revert to an empty array) so real numbers aren't faked.
export const finalists: Finalist[] = [
  {
    slug: 'sofia-ramirez-collage-imposible',
    name: 'Sofía Ramírez',
    countryCode: 'AR',
    artworkTitle: 'El collage imposible',
    technique: 'Collage analógico',
    imageUrl: 'https://picsum.photos/seed/mundial-1/800/1000',
    instagram: '@sofiaramirez.art',
  },
  {
    slug: 'mateo-alviani-frammenti',
    name: 'Mateo Alviani',
    countryCode: 'IT',
    artworkTitle: 'Frammenti',
    technique: 'Collage digital',
    imageUrl: 'https://picsum.photos/seed/mundial-2/800/1000',
    website: 'https://mateoalviani.example.com',
  },
  {
    slug: 'camila-torres-retazos',
    name: 'Camila Torres',
    countryCode: 'CL',
    artworkTitle: 'Retazos del sur',
    technique: 'Collage analógico',
    imageUrl: 'https://picsum.photos/seed/mundial-3/800/1000',
    instagram: '@camitorres',
  },
  {
    slug: 'lucia-fernandez-superposiciones',
    name: 'Lucía Fernández',
    countryCode: 'ES',
    artworkTitle: 'Superposiciones',
    technique: 'Fotomontaje',
    imageUrl: 'https://picsum.photos/seed/mundial-4/800/1000',
  },
  {
    slug: 'diego-herrera-memoria-de-papel',
    name: 'Diego Herrera',
    countryCode: 'MX',
    artworkTitle: 'Memoria de papel',
    technique: 'Collage analógico',
    imageUrl: 'https://picsum.photos/seed/mundial-5/800/1000',
    instagram: '@diegoherrera.mx',
  },
  {
    slug: 'valentina-rojas-cuerpo-territorio',
    name: 'Valentina Rojas',
    countryCode: 'CO',
    artworkTitle: 'Cuerpo territorio',
    technique: 'Collage analógico',
    imageUrl: 'https://picsum.photos/seed/mundial-6/800/1000',
  },
  {
    slug: 'federico-gomez-recortes-urbanos',
    name: 'Federico Gómez',
    countryCode: 'AR',
    artworkTitle: 'Recortes urbanos',
    technique: 'Collage digital',
    imageUrl: 'https://picsum.photos/seed/mundial-7/800/1000',
    instagram: '@fede.gomez',
    website: 'https://fedegomez.example.com',
  },
  {
    slug: 'ana-belen-suarez-costuras',
    name: 'Ana Belén Suárez',
    countryCode: 'PE',
    artworkTitle: 'Costuras invisibles',
    technique: 'Collage mixto',
    imageUrl: 'https://picsum.photos/seed/mundial-8/800/1000',
  },
  {
    slug: 'julieta-medina-archivo-familiar',
    name: 'Julieta Medina',
    countryCode: 'UY',
    artworkTitle: 'Archivo familiar',
    technique: 'Collage analógico',
    imageUrl: 'https://picsum.photos/seed/mundial-9/800/1000',
    instagram: '@juliedina',
  },
  {
    slug: 'pedro-silva-paisagem-cortada',
    name: 'Pedro Silva',
    countryCode: 'BR',
    artworkTitle: 'Paisagem cortada',
    technique: 'Fotomontaje',
    imageUrl: 'https://picsum.photos/seed/mundial-10/800/1000',
  },
]

export function getFinalistBySlug(slug: string) {
  return finalists.find((finalist) => finalist.slug === slug)
}

// Converts an ISO 3166-1 alpha-2 code ("AR") into its Spanish country name
// ("Argentina"). Falls back to the raw code if the runtime can't resolve it.
export function countryCodeToName(countryCode: string) {
  try {
    return new Intl.DisplayNames(['es'], { type: 'region' }).of(countryCode.toUpperCase()) ?? countryCode
  } catch {
    return countryCode
  }
}
