export const FREE_GALLERY_THEMES = ['collage', 'windows98', 'garden'] as const
export const UNLOCKABLE_GALLERY_THEMES = ['atelier', 'industrial', 'museum', 'alley'] as const
export const GALLERY_THEMES = [...FREE_GALLERY_THEMES, ...UNLOCKABLE_GALLERY_THEMES] as const

export type FreeGalleryTheme = (typeof FREE_GALLERY_THEMES)[number]
export type GalleryTheme = (typeof GALLERY_THEMES)[number]

export type GalleryThemeDefinition = {
  id: GalleryTheme
  name: string
  eyebrow: string
  description: string
  canvas: string
  room: {
    wall: string
    floor: string
    ceiling: string
    trim: string
  }
  frame: {
    outer: string
    mat: string
    roughness: number
    emissive?: string
  }
  /** Classical museum trim (and optionally a skylight per room); only for themes with a ceiling. */
  architecture?: {
    molding: string
    /** The shaft between the ceiling and the skylight glass. */
    well: string
    mullion: string
    fixture: string
    /** A glass ceiling in every room; off for now (it reads as visual noise), kept ready to turn back on. */
    skylight: boolean
    sky: 'daylight' | 'clouds'
    planks: boolean
  }
}

export const galleryThemes: Record<GalleryTheme, GalleryThemeDefinition> = {
  windows98: {
    id: 'windows98',
    name: 'Windows 98 + Paint',
    eyebrow: 'MODO 02',
    description: 'Una computadora creativa hecha sala de exposición.',
    canvas: '#008080',
    room: { wall: '#c0c0c0', floor: '#008080', ceiling: '#e8e8e8', trim: '#000080' },
    frame: { outer: '#c0c0c0', mat: '#ffffff', roughness: 0.72 },
    architecture: { molding: '#dedede', well: '#ececec', mullion: '#000080', fixture: '#3a3a3a', skylight: false, sky: 'clouds', planks: false },
  },
  collage: {
    id: 'collage',
    name: 'Adentro de un collage',
    eyebrow: 'MODO 01',
    description: 'Papel, cartón y cinta: una sala armada a mano.',
    canvas: '#d9c7a8',
    room: { wall: '#e8dcc4', floor: '#9d7958', ceiling: '#f2e8d5', trim: '#d84b38' },
    frame: { outer: '#33271f', mat: '#f5ecd9', roughness: 0.82 },
    architecture: { molding: '#f4ebd9', well: '#f1e7d3', mullion: '#8a7762', fixture: '#2e2925', skylight: false, sky: 'daylight', planks: true },
  },
  garden: {
    id: 'garden',
    name: 'Galería jardín',
    eyebrow: 'MODO 03',
    description: 'Cielo abierto, césped, flores y color al aire libre.',
    canvas: '#8fd3ff',
    room: { wall: '#fff0c7', floor: '#72ad53', ceiling: '#c9efff', trim: '#2d7b4a' },
    frame: { outer: '#28543c', mat: '#fffaf0', roughness: 0.78 },
  },
  atelier: {
    id: 'atelier',
    name: 'Taller de artista',
    eyebrow: 'CLUB 01',
    description: 'Madera usada, yeso cálido y el clima de un taller en plena producción.',
    canvas: '#c8b79d',
    room: { wall: '#d8cbb8', floor: '#74513a', ceiling: '#e7ded0', trim: '#503829' },
    frame: { outer: '#6f4d32', mat: '#eee5d5', roughness: 0.82 },
    architecture: { molding: '#dfd3c1', well: '#e9dfd1', mullion: '#5b4636', fixture: '#29231f', skylight: false, sky: 'daylight', planks: true },
  },
  industrial: {
    id: 'industrial',
    name: 'Galpón industrial',
    eyebrow: 'CLUB 02',
    description: 'Hierro oscuro, hormigón y paredes de ladrillo apagado.',
    canvas: '#35383b',
    room: { wall: '#806457', floor: '#55575a', ceiling: '#6b6d70', trim: '#25282b' },
    frame: { outer: '#242629', mat: '#dedbd2', roughness: 0.55 },
    architecture: { molding: '#4b4d50', well: '#6b6d70', mullion: '#202326', fixture: '#191b1d', skylight: false, sky: 'clouds', planks: false },
  },
  museum: {
    id: 'museum',
    name: 'Museo clásico',
    eyebrow: 'CLUB 03',
    description: 'Parquet, molduras y paredes verde inglés para una muestra de salón.',
    canvas: '#27382f',
    room: { wall: '#314c3c', floor: '#6c432e', ceiling: '#e9e1d2', trim: '#c7a86a' },
    frame: { outer: '#b08a3e', mat: '#f5efe2', roughness: 0.32 },
    architecture: { molding: '#d8c9ae', well: '#eee5d5', mullion: '#6e5a3a', fixture: '#30291f', skylight: true, sky: 'daylight', planks: true },
  },
  alley: {
    id: 'alley',
    name: 'Callejón de afiches',
    eyebrow: 'CLUB 04',
    description: 'Cemento, carteles superpuestos y luz nocturna de ciudad.',
    canvas: '#161925',
    room: { wall: '#55545a', floor: '#303238', ceiling: '#242631', trim: '#b94632' },
    frame: { outer: '#1f2024', mat: '#d9d3c7', roughness: 0.7 },
  },
}
