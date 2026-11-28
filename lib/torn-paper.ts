import sharp from 'sharp'

// Torn paper as it looks pasted down (lib/certificate.tsx): an edge that
// wanders at several scales, the paper's white core showing in a band of
// fibres where the coloured face tore further than the back, a fine grain
// and some mottling in the paper, and a soft shadow on what it's stuck to.
//
// Drawn as SVG and rasterised by sharp's librsvg. Noise filters over a whole
// sheet took close to a minute for an A4 at 300 dpi, so the noise is made
// once, in two small tiles, and laid over the paper as a pattern; the fibres
// are in the outline itself. Every shape comes from a fixed seed, so the same
// call always draws the same picture, and each layer is made once per process.

export type Sides = { top?: boolean; right?: boolean; bottom?: boolean; left?: boolean }

export type Piece = {
  /** Centre of the piece, in px of the layer. */
  x: number
  y: number
  w: number
  h: number
  rotate: number
  color: string
  seed: number
  /** Which sides are torn; the rest are clean scissor cuts. All by default. */
  torn?: Sides
  /** How much of the white core shows along a tear (×scale px). */
  fibre?: number
  /** How strong the grain and mottling are: 1 for coloured paper, 0 for none. */
  texture?: number
  /** How far the tear wanders: 1 for a sheet, less for a thin strip. */
  rough?: number
}

function seeded(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Smooth 1-D noise in [0, 1]: random values on a lattice, eased between.
function noise1d(random: () => number) {
  const lattice = Array.from({ length: 512 }, random)
  return (t: number) => {
    const i = Math.floor(t)
    const f = t - i
    const e = f * f * (3 - 2 * f)
    const a = lattice[((i % 512) + 512) % 512]
    const b = lattice[(((i + 1) % 512) + 512) % 512]
    return a + (b - a) * e
  }
}

// A tear: a slow wander, a medium wobble and fine jaggies, as a real edge has.
function tearProfile(random: () => number, scale: number) {
  const slow = noise1d(random)
  const mid = noise1d(random)
  const fine = noise1d(random)
  return (along: number) =>
    slow(along / (260 * scale)) * 0.55 + mid(along / (48 * scale)) * 0.3 + fine(along / (7 * scale)) * 0.15
}

type Point = [number, number]
type Sample = { along: number; depth: number; band: number }

// The outline of the back (outer) and of the coloured face (inner), sampled
// at the same places so the white band between them varies smoothly. The
// back's torn edge bristles with fibres: a fine random fuzz on every point.
// Near a corner the face starts where the neighbouring side's face reaches,
// so the two sides of the face meet there instead of crossing.
function outlines(w: number, h: number, torn: Required<Sides>, seed: number, scale: number, fibre: number, rough = 1) {
  const random = seeded(seed)
  const amp = 22 * scale * rough
  const step = 1.5 * scale
  const fuzz = 3 * scale
  const sample = (length: number, isTorn: boolean): Sample[] => {
    const edge = tearProfile(random, scale)
    const band = noise1d(random)
    const jitter = noise1d(random)
    const samples: Sample[] = []
    for (let along = 0; along < length; along += step) {
      // The band is sometimes almost nothing, sometimes a wide white lip.
      samples.push(isTorn
        ? { along, depth: edge(along) * amp, band: fibre * scale * (0.12 + 2 * Math.pow(band(along / (140 * scale)), 2.2)) + jitter(along / (5 * scale)) * 2.5 * scale }
        : { along, depth: 0, band: 0 })
    }
    return samples
  }
  // Clockwise from the top-left corner: top, right, bottom, left.
  const sides = [sample(w, torn.top), sample(h, torn.right), sample(w, torn.bottom), sample(h, torn.left)]
  const isTorn = [torn.top, torn.right, torn.bottom, torn.left]
  const lengths = [w, h, w, h]
  const reach = (samples: Sample[], at: 'start' | 'end') => {
    const s = at === 'start' ? samples[0] : samples[samples.length - 1]
    return s ? s.depth + s.band + fuzz + 2 * scale : 0
  }
  const corners: Array<(along: number) => Point> = [
    (a) => [a, 0], (a) => [w, a], (a) => [w - a, h], (a) => [0, h - a],
  ]
  const normals: Point[] = [[0, 1], [-1, 0], [0, -1], [1, 0]]
  const outer: Point[] = []
  const inner: Point[] = []
  sides.forEach((samples, i) => {
    const startInset = reach(sides[(i + 3) % 4], 'end')
    const endInset = reach(sides[(i + 1) % 4], 'start')
    const [nx, ny] = normals[i]
    for (const { along, depth, band } of samples) {
      const [x, y] = corners[i](along)
      // Fibres stick out of a tear (negative depth: outwards); a cut is clean.
      const hair = isTorn[i] ? -Math.pow(random(), 3) * fuzz * 1.15 + random() * fuzz * 0.35 : 0
      outer.push([x + nx * (depth + hair), y + ny * (depth + hair)])
      if (along >= startInset && along <= lengths[i] - endInset) {
        const ragged = isTorn[i] ? (random() - 0.5) * 1.4 * scale : 0
        inner.push([x + nx * (depth + band + ragged), y + ny * (depth + band + ragged)])
      }
    }
  })
  return { outer, inner }
}

const path = (points: Point[]) => `M${points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z`

// The paper's texture as two tiles that repeat seamlessly: a fine grain and
// a slow mottling, both dark specks of varying opacity. Made once.
let textures: Promise<{ grain: string; mottle: string }> | null = null

function noiseTile(size: number, frequency: number, octaves: number, gain: number, offset: number) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><filter id="n" x="0" y="0" width="100%" height="100%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${frequency}" numOctaves="${octaves}" seed="9" stitchTiles="stitch"/>` +
    `<feColorMatrix type="matrix" values="0 0 0 0 0.106  0 0 0 0 0.067  0 0 0 0 0.047  ${gain} 0 0 0 ${offset}"/>` +
    `</filter><rect width="${size}" height="${size}" filter="url(#n)"/></svg>`
  return sharp(Buffer.from(svg)).png().toBuffer().then((png) => `data:image/png;base64,${png.toString('base64')}`)
}

function paperTextures() {
  if (!textures) {
    textures = Promise.all([noiseTile(256, 0.7, 2, 0.75, -0.28), noiseTile(128, 0.045, 3, 0.4, -0.14)])
      .then(([grain, mottle]) => ({ grain, mottle }))
    textures.catch(() => { textures = null })
  }
  return textures
}

async function defs(scale: number) {
  const { grain, mottle } = await paperTextures()
  const tile = (256 * Math.max(scale, 0.5)).toFixed(0)
  const blot = (900 * scale).toFixed(0)
  return `
    <pattern id="grain" patternUnits="userSpaceOnUse" width="${tile}" height="${tile}"><image href="${grain}" width="${tile}" height="${tile}" preserveAspectRatio="none"/></pattern>
    <pattern id="mottle" patternUnits="userSpaceOnUse" width="${blot}" height="${blot}"><image href="${mottle}" width="${blot}" height="${blot}" preserveAspectRatio="none"/></pattern>
    <filter id="contact" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="${1.6 * scale}"/>
    </filter>
    <linearGradient id="light" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.10"/>
      <stop offset="0.55" stop-color="#FFFFFF" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.07"/>
    </linearGradient>`
}

function pieceSvg(piece: Piece, scale: number) {
  const torn = { top: true, right: true, bottom: true, left: true, ...piece.torn }
  const { outer, inner } = outlines(piece.w, piece.h, torn, piece.seed, scale, piece.fibre ?? 16, piece.rough)
  const place = `translate(${piece.x.toFixed(1)} ${piece.y.toFixed(1)}) rotate(${piece.rotate}) translate(${(-piece.w / 2).toFixed(1)} ${(-piece.h / 2).toFixed(1)})`
  const back = path(outer)
  const face = path(inner)
  const texture = piece.texture ?? 1
  const id = `p${piece.seed}`
  // Blur regions just past the paper: blurring is paid per pixel of the
  // region, and the default one is a fifth bigger on every side.
  const region = (blur: number) => {
    const fx = (blur * 3 + 30 * scale) / piece.w
    const fy = (blur * 3 + 30 * scale) / piece.h
    return `x="${(-fx).toFixed(4)}" y="${(-fy).toFixed(4)}" width="${(1 + fx * 2).toFixed(4)}" height="${(1 + fy * 2).toFixed(4)}"`
  }
  return (
    `<filter id="${id}s" ${region(7 * scale)}><feGaussianBlur stdDeviation="${7 * scale}"/></filter>` +
    `<filter id="${id}c" ${region(1.6 * scale)}><feGaussianBlur stdDeviation="${1.6 * scale}"/></filter>` +
    // A wide soft shadow offset down-right, and a tight one where it touches.
    `<g transform="translate(${3 * scale} ${6 * scale})"><g transform="${place}"><path d="${back}" fill="#1B110C" fill-opacity="0.26" filter="url(#${id}s)"/></g></g>` +
    `<g transform="${place}">` +
    `<path d="${back}" fill="#1B110C" fill-opacity="0.18" filter="url(#${id}c)"/>` +
    // The back: the paper's white core, a little grey and grainy.
    `<path d="${back}" fill="#F6F3EC"/>` +
    (texture > 0 ? `<path d="${back}" fill="url(#grain)" opacity="0.55"/>` : '') +
    // The face, kept inside the back, with its grain and mottling.
    `<clipPath id="${id}"><path d="${back}"/></clipPath>` +
    `<g clip-path="url(#${id})">` +
    `<path d="${face}" fill="${piece.color}"/>` +
    (texture > 0
      ? `<path d="${face}" fill="url(#grain)" opacity="${(0.9 * texture).toFixed(2)}"/>` +
        `<path d="${face}" fill="url(#mottle)" opacity="${texture.toFixed(2)}"/>`
      : '') +
    `<path d="${face}" fill="url(#light)"/>` +
    `</g></g>`
  )
}

function svgDocument(width: number, height: number, viewBox: string, body: string, scale: number) {
  return defs(scale).then((d) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}"><defs>${d}</defs>${body}</svg>`)
}

const layers = new Map<string, Promise<Buffer>>()

/** A background with these pieces stuck on it, in order, as a PNG. */
export function paperLayer(width: number, height: number, background: string, pieces: Piece[], scale = 1): Promise<Buffer> {
  const key = JSON.stringify([width, height, background, pieces, scale])
  let layer = layers.get(key)
  if (!layer) {
    // Drawn with a margin and cropped: a shadow or a paper running off the
    // page would otherwise stop short at the edge of the canvas.
    const margin = Math.round(80 * scale)
    const body =
      `<rect x="${-margin}" y="${-margin}" width="${width + margin * 2}" height="${height + margin * 2}" fill="${background}"/>` +
      pieces.map((piece) => pieceSvg(piece, scale)).join('')
    layer = svgDocument(width + margin * 2, height + margin * 2, `${-margin} ${-margin} ${width + margin * 2} ${height + margin * 2}`, body, scale)
      .then((svg) => sharp(Buffer.from(svg)).extract({ left: margin, top: margin, width, height }).png().toBuffer())
    // A failure isn't kept: the next certificate tries again.
    layer.catch(() => layers.delete(key))
    layers.set(key, layer)
  }
  return layer
}

type TapeImage = { src: string; width: number; height: number }
const tapes = new Map<string, Promise<TapeImage>>()

/**
 * A strip of masking tape as a PNG data URI (with a margin for its shadow),
 * for satori to lay over the obra: translucent, a little grainy, torn off at
 * both ends.
 */
export function tapeImage(w: number, h: number, seed: number, scale = 1): Promise<TapeImage> {
  const key = JSON.stringify([w, h, seed, scale])
  let tape = tapes.get(key)
  if (!tape) {
    const pad = Math.round(10 * scale)
    const width = w + pad * 2
    const height = h + pad * 2
    const outline = path(outlines(w, h, { top: false, bottom: false, left: true, right: true }, seed, scale * 0.7, 0).outer)
    const body =
      `<g transform="translate(${pad} ${pad})">` +
      `<path d="${outline}" transform="translate(0 ${1.5 * scale})" fill="#1B110C" fill-opacity="0.16" filter="url(#contact)"/>` +
      `<g opacity="0.8"><path d="${outline}" fill="#ECE1C4"/><path d="${outline}" fill="url(#grain)" opacity="0.6"/></g>` +
      // The sheen along its length, and a couple of wrinkles across it.
      `<path d="M0,${(h * 0.2).toFixed(1)}L${w},${(h * 0.24).toFixed(1)}" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="${2 * scale}" filter="url(#contact)"/>` +
      `<path d="M${(w * 0.32).toFixed(1)},0L${(w * 0.36).toFixed(1)},${h}" stroke="#7A6A48" stroke-opacity="0.12" stroke-width="${1.5 * scale}" filter="url(#contact)"/>` +
      `<path d="M${(w * 0.7).toFixed(1)},0L${(w * 0.66).toFixed(1)},${h}" stroke="#FFFFFF" stroke-opacity="0.22" stroke-width="${1.5 * scale}" filter="url(#contact)"/>` +
      `</g>`
    tape = svgDocument(width, height, `0 0 ${width} ${height}`, body, scale * 0.6)
      .then((svg) => sharp(Buffer.from(svg)).png().toBuffer())
      .then((png) => ({ src: `data:image/png;base64,${png.toString('base64')}`, width, height }))
    tape.catch(() => tapes.delete(key))
    tapes.set(key, tape)
  }
  return tape
}

const strips = new Map<string, Promise<string>>()

/**
 * A torn strip of coloured paper as a PNG data URI, to stretch behind a
 * label in satori (backgroundSize 100% 100%): its size only sets the shape,
 * the label decides the final one. `margin` px around it hold its shadow.
 */
export function stripImage(w: number, h: number, color: string, seed: number, scale = 1, margin = Math.round(8 * scale)): Promise<string> {
  const key = JSON.stringify([w, h, color, seed, scale, margin])
  let strip = strips.get(key)
  if (!strip) {
    const width = w + margin * 2
    const height = h + margin * 2
    const piece: Piece = { x: width / 2, y: height / 2, w, h, rotate: 0, color, seed, fibre: 5, rough: 0.3 }
    strip = svgDocument(width, height, `0 0 ${width} ${height}`, pieceSvg(piece, scale * 0.5), scale * 0.5)
      .then((svg) => sharp(Buffer.from(svg)).png().toBuffer())
      .then((png) => `data:image/png;base64,${png.toString('base64')}`)
    strip.catch(() => strips.delete(key))
    strips.set(key, strip)
  }
  return strip
}
