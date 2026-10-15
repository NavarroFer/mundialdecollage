import * as THREE from 'three'

// The people's clothes, computed pixel by pixel on the visitor's device
// instead of shipped as images. Each fabric is a function over one tile of
// cloth, in tile coordinates [0, 1) with y going up, and periodic so the tile
// repeats without seams. Loft UVs are in meters, so a tile's size is real.

export type Fabric = 'jersey' | 'knit' | 'satin' | 'poplin' | 'gabardine' | 'denim' | 'twill' | 'crepe' | 'leather' | 'canvas' | 'rubber'

/** Brightness at a point of the tile: 1 is the garment's own color, lower is shadow between threads. */
type Weave = (x: number, y: number) => number

type FabricSpec = {
  /** Meters of cloth one tile covers. */
  tile: number
  roughness: number
  /** How deep the shared folds read on it; 0 leaves them out. */
  folds: number
  /** Built once per texture: some weaves draw their random threads up front. */
  weave: () => Weave
}

const TAU = Math.PI * 2
// Pixels per tile side: about half a millimeter each, finer than a screen
// shows a person from arm's length, and quick enough to compute on a phone.
const SIZE = 128

function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

const wrap = (i: number, n: number) => ((i % n) + n) % n
const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const ease = (t: number) => t * t * (3 - 2 * t)
const smoothstep = (from: number, to: number, value: number) => ease(clamp01((value - from) / (to - from)))

/** Smooth value noise in [0, 1] on a lattice of cellsX × cellsY that wraps around the tile. */
function tileNoise(cellsX: number, cellsY: number, seed: number) {
  const random = seeded(seed)
  const lattice = Array.from({ length: cellsX * cellsY }, random)
  const at = (i: number, j: number) => lattice[wrap(j, cellsY) * cellsX + wrap(i, cellsX)]
  return (x: number, y: number) => {
    const fx = x * cellsX
    const fy = y * cellsY
    const i = Math.floor(fx)
    const j = Math.floor(fy)
    const sx = ease(fx - i)
    const sy = ease(fy - j)
    const bottom = at(i, j) + (at(i + 1, j) - at(i, j)) * sx
    const top = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * sx
    return bottom + (top - bottom) * sy
  }
}

/**
 * Diagonal ribs, `n` per tile each way. Climbing `steep` times faster than
 * they run gives gabardine's steep twill; 1 is denim's 45°.
 */
const twill = (n: number, steep = 1): Weave => (x, y) => 0.5 + 0.5 * Math.cos(TAU * n * (steep * x - y))

/** Over-under threads: each cell shows the vertical or the horizontal one on top, some thicker than others. */
function plainWeave(threads: number, seed: number): Weave {
  const random = seeded(seed)
  const warp = Array.from({ length: threads }, () => 0.8 + random() * 0.2)
  const weft = Array.from({ length: threads }, () => 0.8 + random() * 0.2)
  return (x, y) => {
    const fx = x * threads
    const fy = y * threads
    const i = Math.floor(fx)
    const j = Math.floor(fy)
    const vertical = (i + j) % 2 === 0
    const across = vertical ? fx - i : fy - j
    // Round in section: bright on the crown, dark where it dips under the next thread.
    return Math.sqrt(1 - (2 * across - 1) ** 2) * (vertical ? warp[i] : weft[j])
  }
}

/** Stockinette: columns of V-shaped stitches, each two loops of yarn leaning out from the bottom. */
function stockinette(columns: number, rows: number): Weave {
  const loop = (u: number, v: number, side: -1 | 1) => {
    const dx = u - (0.5 + side * 0.2)
    const dy = v - 0.5
    const along = dx * side * 0.33 + dy * 0.944
    const across = dx * 0.944 - dy * side * 0.33
    return Math.max(0, 1 - (along / 0.6) ** 2 - (across / 0.2) ** 2)
  }
  return (x, y) => {
    const u = x * columns - Math.floor(x * columns)
    const fy = y * rows
    const v = fy - Math.floor(fy)
    // Each row's loops reach into the rows above and below.
    let yarn = 0
    for (const shift of [-1, 0, 1]) yarn = Math.max(yarn, loop(u, v - shift, -1), loop(u, v - shift, 1))
    return Math.sqrt(yarn)
  }
}

/** Pebbled grain: small irregular cells with creases between them (F2 − F1 of a wrapped Worley grid). */
function pebbles(cells: number, seed: number): Weave {
  const random = seeded(seed)
  const points = Array.from({ length: cells * cells }, () => [random(), random()] as const)
  return (x, y) => {
    const fx = x * cells
    const fy = y * cells
    const i = Math.floor(fx)
    const j = Math.floor(fy)
    let first = Infinity
    let second = Infinity
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const [px, py] = points[wrap(j + dj, cells) * cells + wrap(i + di, cells)]
        const distance = Math.hypot(i + di + px - fx, j + dj + py - fy)
        if (distance < first) [first, second] = [distance, first]
        else if (distance < second) second = distance
      }
    }
    return smoothstep(0, 0.3, second - first)
  }
}

export const FABRICS: Record<Fabric, FabricSpec> = {
  // Tees: a fine knit you only make out up close, over a soft heather.
  jersey: {
    tile: 0.03, roughness: 0.92, folds: 0.35,
    weave: () => {
      const knit = stockinette(20, 28)
      const heather = tileNoise(12, 12, 3)
      return (x, y) => 0.8 + 0.13 * knit(x, y) + 0.08 * (heather(x, y) - 0.5)
    },
  },
  // Sweaters and cardigans: chunky stitches about 8 mm wide, in a mélange yarn.
  knit: {
    tile: 0.064, roughness: 1, folds: 0.3,
    weave: () => {
      const knit = stockinette(8, 12)
      const melange = tileNoise(32, 48, 5)
      return (x, y) => 0.48 + 0.44 * knit(x, y) + 0.12 * (melange(x, y) - 0.5)
    },
  },
  // Camisoles: smooth and glossy, with long threads floating sideways.
  satin: {
    tile: 0.1, roughness: 0.42, folds: 0.6,
    weave: () => {
      const floats = tileNoise(3, 64, 7)
      return (x, y) => 0.92 + 0.08 * floats(x, y)
    },
  },
  // Shirts: a tight plain weave.
  poplin: {
    tile: 0.06, roughness: 0.8, folds: 0.45,
    weave: () => {
      const threads = plainWeave(32, 9)
      const heather = tileNoise(8, 8, 10)
      return (x, y) => 0.84 + 0.14 * threads(x, y) + 0.04 * (heather(x, y) - 0.5)
    },
  },
  // Trench coats: gabardine's steep, close twill.
  gabardine: {
    tile: 0.05, roughness: 0.72, folds: 0.45,
    weave: () => {
      const ribs = twill(10, 2)
      const heather = tileNoise(10, 10, 11)
      return (x, y) => 0.8 + 0.16 * ribs(x, y) + 0.06 * (heather(x, y) - 0.5)
    },
  },
  // Jeans and denim jackets: 45° twill, uneven vertical yarns (slubs) and white specks of weft.
  denim: {
    tile: 0.08, roughness: 0.92, folds: 0.6,
    weave: () => {
      const ribs = twill(24)
      // Long streaks: a slub runs up the whole tile.
      const slubs = tileNoise(48, 2, 13)
      const specks = tileNoise(64, 64, 14)
      const fade = tileNoise(3, 3, 15)
      return (x, y) => clamp01(0.62 + 0.22 * ribs(x, y) ** 1.5 + 0.18 * (slubs(x, y) - 0.5)
        + 0.25 * smoothstep(0.72, 0.9, specks(x, y)) + 0.08 * (fade(x, y) - 0.5))
    },
  },
  // Trousers, chinos and caps: a fine, quiet twill.
  twill: {
    tile: 0.05, roughness: 0.85, folds: 0.5,
    weave: () => {
      const ribs = twill(16)
      const heather = tileNoise(12, 12, 17)
      return (x, y) => 0.84 + 0.11 * ribs(x, y) + 0.06 * (heather(x, y) - 0.5)
    },
  },
  // Skirts and dresses: crepe's pebbly, matte grain.
  crepe: {
    tile: 0.05, roughness: 0.95, folds: 0.45,
    weave: () => {
      const grain = tileNoise(64, 64, 19)
      const cloud = tileNoise(16, 16, 20)
      return (x, y) => 0.84 + 0.12 * grain(x, y) + 0.04 * cloud(x, y)
    },
  },
  // Shoes and bags: pebbled leather with a soft shine.
  leather: {
    tile: 0.06, roughness: 0.5, folds: 0.25,
    weave: () => {
      const grain = pebbles(16, 23)
      const cloud = tileNoise(8, 8, 24)
      return (x, y) => 0.7 + 0.26 * grain(x, y) + 0.08 * (cloud(x, y) - 0.5)
    },
  },
  // Sneakers and totes: a coarse plain weave.
  canvas: {
    tile: 0.04, roughness: 0.95, folds: 0.35,
    weave: () => {
      const threads = plainWeave(18, 25)
      return (x, y) => 0.66 + 0.32 * threads(x, y)
    },
  },
  // Soles.
  rubber: {
    tile: 0.03, roughness: 0.85, folds: 0,
    weave: () => {
      const grain = tileNoise(48, 48, 27)
      return (x, y) => 0.9 + 0.08 * grain(x, y)
    },
  },
}

/** A fabric's brightness over one tile, row by row from the bottom, sampled at pixel centers. */
export function weaveField(fabric: Fabric, size = SIZE) {
  const weave = FABRICS[fabric].weave()
  const field = new Float32Array(size * size)
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) field[j * size + i] = clamp01(weave((i + 0.5) / size, (j + 0.5) / size))
  }
  return field
}

const toLinear = (srgb: number) => srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
const toSRGB = (linear: number) => linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055

/** How much the texture darkens the color it multiplies, on average (in linear light). */
export function toneOf(field: Float32Array) {
  let sum = 0
  for (const value of field) sum += toLinear(value)
  return sum / field.length
}

/** Meters one tile of folds covers: big enough that a person doesn't show the repeat. */
const FOLD_TILE = 0.45

/**
 * Creases, mostly running around a limb or a body like real ones do, as a
 * tangent-space normal map (xyz in [-1, 1], three per pixel).
 */
export function foldNormals(size = SIZE) {
  const ridges = tileNoise(3, 9, 31)
  const swell = tileNoise(5, 5, 32)
  const height = new Float32Array(size * size)
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = (i + 0.5) / size
      const y = (j + 0.5) / size
      // Ridged noise: a sharp fold wherever the noise crosses its midpoint.
      height[j * size + i] = 0.6 * (1 - Math.abs(2 * ridges(x, y) - 1)) ** 3 + 0.4 * swell(x, y)
    }
  }
  // Slope per tile turned into a tilt: up to about 35° on the steepest folds.
  const strength = size / 80
  const normals = new Float32Array(size * size * 3)
  const at = (i: number, j: number) => height[wrap(j, size) * size + wrap(i, size)]
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const nx = -(at(i + 1, j) - at(i - 1, j)) * strength
      const ny = -(at(i, j + 1) - at(i, j - 1)) * strength
      const length = Math.hypot(nx, ny, 1)
      normals.set([nx / length, ny / length, 1 / length], (j * size + i) * 3)
    }
  }
  return normals
}

function dataTexture(data: Uint8Array, size: number, tile: number, colorSpace: THREE.ColorSpace) {
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType)
  texture.colorSpace = colorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.repeat.setScalar(1 / tile)
  texture.needsUpdate = true
  return texture
}

// Shared by every person, like the geometries and materials: a fixed, small set.
const weaves = new Map<string, { map: THREE.DataTexture; tone: number }>()
let folds: THREE.DataTexture | null = null

/** The fabric's tile in sRGB, gray or dyed: `stripes` with a lighter stripe down each tile's left edge. */
function weaveTexture(fabric: Fabric, stripes: string | null) {
  const key = `${fabric} ${stripes ?? ''}`
  let entry = weaves.get(key)
  if (!entry) {
    const field = weaveField(fabric)
    const data = new Uint8Array(SIZE * SIZE * 4).fill(255)
    if (stripes) {
      // Dyed in linear light (three.js converts hex on the way in), stored as sRGB.
      const ground = new THREE.Color(stripes)
      const stripe = ground.clone().lerp(new THREE.Color('#ffffff'), 0.7)
      field.forEach((value, p) => {
        const dye = (p % SIZE) / SIZE < 0.18 ? stripe : ground
        const shade = toLinear(value)
        data[p * 4] = toSRGB(dye.r * shade) * 255
        data[p * 4 + 1] = toSRGB(dye.g * shade) * 255
        data[p * 4 + 2] = toSRGB(dye.b * shade) * 255
      })
    } else {
      field.forEach((value, p) => data.fill(value * 255, p * 4, p * 4 + 3))
    }
    weaves.set(key, entry = { map: dataTexture(data, SIZE, FABRICS[fabric].tile, THREE.SRGBColorSpace), tone: toneOf(field) })
  }
  return entry
}

function foldTexture() {
  if (!folds) {
    const normals = foldNormals()
    const data = new Uint8Array(SIZE * SIZE * 4)
    for (let p = 0; p < SIZE * SIZE; p++) {
      for (let c = 0; c < 3; c++) data[p * 4 + c] = (normals[p * 3 + c] * 0.5 + 0.5) * 255
      data[p * 4 + 3] = 255
    }
    folds = dataTexture(data, SIZE, FOLD_TILE, THREE.NoColorSpace)
  }
  return folds
}

/**
 * The parts of a MeshStandardMaterial that make it this fabric in this color.
 * A plain garment keeps its color on average: the color is brightened by as
 * much as the weave's shadows darken it. A striped one bakes its colors in.
 */
export function cloth(fabric: Fabric, color: string, { stripes = false } = {}): THREE.MeshStandardMaterialParameters {
  const spec = FABRICS[fabric]
  const { map, tone } = weaveTexture(fabric, stripes ? color : null)
  return {
    color: stripes ? new THREE.Color('#ffffff').multiplyScalar(1 / tone) : new THREE.Color(color).multiplyScalar(1 / tone),
    map,
    roughness: spec.roughness,
    ...(spec.folds > 0 && { normalMap: foldTexture(), normalScale: new THREE.Vector2(spec.folds, spec.folds) }),
  }
}
