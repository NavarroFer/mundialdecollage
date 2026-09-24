export const GALLERY_THEMES = ['collage', 'windows98', 'garden'] as const

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
}
