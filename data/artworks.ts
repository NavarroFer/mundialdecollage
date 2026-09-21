export type Artwork = {
  id: string
  title: string
  artist: string
  year: number
  image: string
  description: string
  roomId: string
  position: [number, number, number]
  rotation: [number, number, number]
  width: number
  height: number
}

export const artworks: Artwork[] = [
  {
    id: 'obra-01',
    title: 'Recortes de domingo',
    artist: 'Juana Ibarra',
    year: 2025,
    image: '/artworks/obra-01.webp',
    description: 'Fragmentos de diarios y revistas de los noventa, recompuestos en una escena doméstica imposible.',
    roomId: 'room-01',
    position: [-15.5, 1.8, -4.9],
    rotation: [0, 0, 0],
    width: 2.4,
    height: 1.6,
  },
  {
    id: 'obra-02',
    title: 'Mapa imposible',
    artist: 'Tomás Ferreyra',
    year: 2026,
    image: '/artworks/obra-02.webp',
    description: 'Un atlas recortado y vuelto a unir sin respetar fronteras ni escalas.',
    roomId: 'room-01',
    position: [-8.5, 1.9, -4.9],
    rotation: [0, 0, 0],
    width: 1.4,
    height: 2.0,
  },
  {
    id: 'obra-03',
    title: 'Retrato con ruido',
    artist: 'Camila Suárez',
    year: 2025,
    image: '/artworks/obra-03.webp',
    description: 'Un rostro construido a partir de capas de papel encontrado y estática de televisión analógica.',
    roomId: 'room-01',
    position: [-12, 1.8, 4.9],
    rotation: [0, Math.PI, 0],
    width: 1.8,
    height: 1.8,
  },
  {
    id: 'obra-04',
    title: 'Domingo eléctrico',
    artist: 'Bruno Acosta',
    year: 2026,
    image: '/artworks/obra-04.webp',
    description: 'Cables, enchufes y facturas de luz recortados en homenaje al living familiar.',
    roomId: 'room-02',
    position: [0, 1.8, -4.9],
    rotation: [0, 0, 0],
    width: 2.0,
    height: 1.3,
  },
  {
    id: 'obra-05',
    title: 'Herbario urbano',
    artist: 'Delfina Rojas',
    year: 2025,
    image: '/artworks/obra-05.webp',
    description: 'Hojas prensadas junto a recortes de cemento y asfalto fotografiado.',
    roomId: 'room-02',
    position: [0, 1.9, 4.9],
    rotation: [0, Math.PI, 0],
    width: 1.5,
    height: 2.1,
  },
  {
    id: 'obra-06',
    title: 'Mundial de bolsillo',
    artist: 'Nicolás Peralta',
    year: 2026,
    image: '/artworks/obra-06.webp',
    description: 'Figuritas incompletas de un álbum mundialista, reorganizadas en un nuevo seleccionado.',
    roomId: 'room-03',
    position: [9.5, 1.75, -4.9],
    rotation: [0, 0, 0],
    width: 2.6,
    height: 1.5,
  },
  {
    id: 'obra-07',
    title: 'Postal sin destino',
    artist: 'Ana Belén Correa',
    year: 2025,
    image: '/artworks/obra-07.webp',
    description: 'Estampillas y sobres viejos superpuestos sobre una postal nunca enviada.',
    roomId: 'room-03',
    position: [9.5, 1.9, 4.9],
    rotation: [0, Math.PI, 0],
    width: 1.3,
    height: 1.9,
  },
  {
    id: 'obra-08',
    title: 'Fin de fiesta',
    artist: 'Lautaro Méndez',
    year: 2026,
    image: '/artworks/obra-08.webp',
    description: 'Serpentinas, entradas y servilletas de un cumpleaños compuestas como paisaje.',
    roomId: 'room-03',
    position: [15.5, 1.8, 4.9],
    rotation: [0, Math.PI, 0],
    width: 1.9,
    height: 1.9,
  },
]
