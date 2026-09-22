export const GALLERY_THEMES = ['museum', 'windows98', 'ps2', 'collage'] as const

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
}

export const galleryThemes: Record<GalleryTheme, GalleryThemeDefinition> = {
  museum: {
    id: 'museum',
    name: 'Museo actual',
    eyebrow: 'MODO 01',
    description: 'Luz cálida, paredes neutras y marcos de museo.',
    canvas: '#e9e6dd',
    room: { wall: '#f2f1ec', floor: '#c9cbd0', ceiling: '#f8f8f6', trim: '#232323' },
    frame: { outer: '#161513', mat: '#f7f5f0', roughness: 0.55 },
  },
  windows98: {
    id: 'windows98',
    name: 'Windows 98 + Paint',
    eyebrow: 'MODO 02',
    description: 'Una computadora creativa hecha sala de exposición.',
    canvas: '#008080',
    room: { wall: '#c0c0c0', floor: '#008080', ceiling: '#e8e8e8', trim: '#000080' },
    frame: { outer: '#c0c0c0', mat: '#ffffff', roughness: 0.72 },
  },
  ps2: {
    id: 'ps2',
    name: 'PS2 / Año 2000',
    eyebrow: 'MODO 03',
    description: 'Azul profundo, luz eléctrica y arquitectura de consola.',
    canvas: '#02020d',
    room: { wall: '#080823', floor: '#03030d', ceiling: '#111142', trim: '#2455ff' },
    frame: { outer: '#101064', mat: '#09091c', roughness: 0.3, emissive: '#172bba' },
  },
  collage: {
    id: 'collage',
    name: 'Adentro de un collage',
    eyebrow: 'MODO 04',
    description: 'Papel, cartón y cinta: una sala armada a mano.',
    canvas: '#d9c7a8',
    room: { wall: '#e8dcc4', floor: '#9d7958', ceiling: '#f2e8d5', trim: '#d84b38' },
    frame: { outer: '#33271f', mat: '#f5ecd9', roughness: 0.82 },
  },
}
