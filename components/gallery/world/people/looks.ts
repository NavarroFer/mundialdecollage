// Who walks around the gallery. Each look is one outfit; the visitor's accent
// color (the same one as their marker and minimap dot) fills in whichever
// garment leaves its color out.

export type Build = 'm' | 'f'
export type Hair = 'long' | 'wavy' | 'bob' | 'bun' | 'crop' | 'curly' | 'short'
export type ArmPose = 'swing' | 'cup' | 'pocket' | 'strap'

export type Look = {
  build: Build
  /** Scales the whole figure; 1 is about 1.73 m. */
  height: number
  skin: string
  hair: Hair
  hairColor: string
  /** The layer against the body. A camisole leaves shoulders and arms bare. */
  top: { kind: 'tee' | 'sweater' | 'camisole'; color?: string }
  /** An open layer over the top. */
  outer?: { kind: 'trench' | 'shirt' | 'jacket' | 'cardigan'; color?: string; stripes?: boolean }
  sleeves: 'short' | 'long'
  bottom: { kind: 'trousers' | 'wide' | 'jeans' | 'skirt' | 'dress'; color?: string }
  shoes: { kind: 'sneakers' | 'sandals' | 'boots' | 'loafers'; color: string; sole: string }
  glasses?: 'sun' | 'thick' | 'round'
  cap?: string
  beard?: string
  bag?: string
  /** The right hand carries a coffee; the left one rests in a pocket. */
  cup?: boolean
  pocket?: boolean
}

export const LOOKS: Look[] = [
  // Trench coat, pleated midi skirt, white sunglasses and a tote.
  {
    build: 'f', height: 0.97, skin: '#e2aa86', hair: 'wavy', hairColor: '#6e3526',
    top: { kind: 'camisole' }, outer: { kind: 'trench', color: '#b58e58' }, sleeves: 'long',
    bottom: { kind: 'skirt', color: '#ece3d0' }, shoes: { kind: 'sandals', color: '#efe8da', sole: '#e4dccb' },
    glasses: 'sun', bag: '#e6dfd0',
  },
  // Cap, thick glasses, beard, open striped shirt over a tee, cuffed trousers, coffee.
  {
    build: 'm', height: 1.02, skin: '#e59a6c', hair: 'short', hairColor: '#2a2624',
    top: { kind: 'tee', color: '#ecebe5' }, outer: { kind: 'shirt', stripes: true }, sleeves: 'short',
    bottom: { kind: 'wide', color: '#1f1e1d' }, shoes: { kind: 'sneakers', color: '#1d1d1d', sole: '#eadcc2' },
    glasses: 'thick', cap: '#1b1b1b', beard: '#3b3a39', cup: true, pocket: true,
  },
  {
    build: 'f', height: 0.95, skin: '#9c6646', hair: 'bun', hairColor: '#2a1e18',
    top: { kind: 'sweater' }, sleeves: 'long',
    bottom: { kind: 'jeans', color: '#4d6587' }, shoes: { kind: 'sneakers', color: '#f1efe9', sole: '#f1efe9' },
  },
  {
    build: 'm', height: 1, skin: '#c98c65', hair: 'crop', hairColor: '#46301f',
    top: { kind: 'tee' }, sleeves: 'short',
    bottom: { kind: 'trousers', color: '#c9b690' }, shoes: { kind: 'loafers', color: '#5b3a25', sole: '#2e2520' },
    pocket: true,
  },
  {
    build: 'f', height: 0.98, skin: '#f1c6a6', hair: 'bob', hairColor: '#1d1a19',
    top: { kind: 'tee' }, sleeves: 'short',
    bottom: { kind: 'dress' }, shoes: { kind: 'boots', color: '#2b2421', sole: '#1b1715' },
    bag: '#6b4330',
  },
  {
    build: 'm', height: 1.04, skin: '#6f4532', hair: 'curly', hairColor: '#1b1512',
    top: { kind: 'tee' }, outer: { kind: 'jacket', color: '#52698d' }, sleeves: 'long',
    bottom: { kind: 'trousers', color: '#2f2e2c' }, shoes: { kind: 'sneakers', color: '#f0eee8', sole: '#f0eee8' },
  },
  {
    build: 'm', height: 0.98, skin: '#dba686', hair: 'crop', hairColor: '#c2bdb5',
    top: { kind: 'tee', color: '#e9e4d8' }, outer: { kind: 'cardigan' }, sleeves: 'long',
    bottom: { kind: 'trousers', color: '#5b5650' }, shoes: { kind: 'loafers', color: '#3b2a20', sole: '#241b16' },
    glasses: 'round', beard: '#b9b4ac', cup: true,
  },
  {
    build: 'f', height: 1, skin: '#ebb996', hair: 'long', hairColor: '#c9a06b',
    top: { kind: 'tee', color: '#f2eee5' }, outer: { kind: 'cardigan' }, sleeves: 'long',
    bottom: { kind: 'wide', color: '#3b3e46' }, shoes: { kind: 'loafers', color: '#1f1d1c', sole: '#141312' },
  },
]
