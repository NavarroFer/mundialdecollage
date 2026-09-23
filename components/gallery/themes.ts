export const GALLERY_THEMES = ['collage', 'museum', 'windows98', 'garden'] as const

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
    eyebrow: 'MODO 02',
    description: 'Luz cálida, paredes neutras y marcos de museo.',
    canvas: '#e9e6dd',
    room: { wall: '#f2f1ec', floor: '#c9cbd0', ceiling: '#f8f8f6', trim: '#232323' },
    frame: { outer: '#161513', mat: '#f7f5f0', roughness: 0.55 },
  },
  windows98: {
    id: 'windows98',
    name: 'Windows 98 + Paint',
    eyebrow: 'MODO 03',
    description: 'Una computadora creativa hecha sala de exposición.',
    canvas: '#008080',
    room: { wall: '#c0c0c0', floor: '#008080', ceiling: '#e8e8e8', trim: '#000080' },
    frame: { outer: '#c0c0c0', mat: '#ffffff', roughness: 0.72 },
  },
  collage: {
    id: 'collage',
    name: 'Adentro de un collage',
    eyebrow: 'MODO 01',
    description: 'Papel, cartón y cinta: una sala armada a mano.',
    canvas: '#d9c7a8',
    room: { wall: '#e8dcc4', floor: '#9d7958', ceiling: '#f2e8d5', trim: '#d84b38' },
    frame: { outer: '#33271f', mat: '#f5ecd9', roughness: 0.82 },
  },
  garden: {
    id: 'garden',
    name: 'Galería jardín',
    eyebrow: 'MODO 04',
    description: 'Cielo abierto, césped, flores y color al aire libre.',
    canvas: '#8fd3ff',
    room: { wall: '#fff0c7', floor: '#72ad53', ceiling: '#c9efff', trim: '#2d7b4a' },
    frame: { outer: '#28543c', mat: '#fffaf0', roughness: 0.78 },
  },
}
