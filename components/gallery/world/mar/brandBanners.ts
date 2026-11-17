import type * as THREE from 'three'
import { imageSrc } from '@/lib/image-src'
import { cutoutPlans } from '@/lib/store'
import { canvasFonts } from '../../fonts'
import { BRAND, BRAND_DOMAIN, wrapByWidth } from './brand'
import { paperGround, tape, tornSheet } from './paperCraft'
import { canvasOf, canvasTexture } from './textures'

// The signs on the building, in the Mundial de Collage's identity: paper,
// a hand-torn sheet of blue held on with red and yellow tape (paperCraft.ts),
// the real logo, and every word in the brand's Anton. Each one tells what
// there is on the site — the magazine, the cutouts, the community, the walk
// itself — and the page it is on. They stand in for the banners that will be
// printed for the venue; a slot's own `image` (layout.ts) replaces any of them.

type Spec = {
  /** Canvas size, pixels. */
  width: number
  height: number
  /** Where the logo goes and which one: the globe above the wordmark, or the long logo. */
  layout: 'poster' | 'long'
  /** A word on a torn red label over the sheet's corner. */
  tag?: string
  headline: string
  line: string
  /** What there is to find, one per line (the long vinyl runs them in a row). */
  points: string[]
  /** The page it is on, printed after the domain. */
  path?: string
}

/** «50, 100 o 200», from the store's own packs. */
const PACKS = new Intl.ListFormat('es', { type: 'disjunction' }).format(cutoutPlans.map((plan) => String(plan.count)))

const SPECS: Record<string, Spec> = {
  'door-a': {
    width: 540, height: 990, layout: 'poster', tag: 'Preventa',
    headline: 'Revista del Mundial', line: 'Primera edición, impresa',
    points: ['Las 30 obras finalistas, a página completa', 'Todos los participantes en el índice', 'Envíos a todo el mundo'],
    path: '/revista',
  },
  'door-b': {
    width: 360, height: 990, layout: 'poster', tag: 'Por correo',
    headline: 'Recortes cada mes', line: 'Para tus collages',
    points: [`Vintage, en packs de ${PACKS}`, 'Con stickers'],
    path: '/tienda',
  },
  'door-c': {
    width: 510, height: 960, layout: 'poster',
    headline: 'Comunidad', line: 'Lo que comparten los artistas',
    points: ['Obras, recorridos y procesos', 'Traducido a tu idioma', 'Artistas que te pueden gustar'],
    path: '/comunidad',
  },
  vinyl: {
    width: 2048, height: 516, layout: 'long',
    headline: 'Exposición internacional de collage', line: 'Artistas de muchos países, en una sola muestra',
    points: ['Galería 3D', 'Mapa del Mundial', 'Comunidad', 'Tienda', 'Revista'],
  },
  // At the foot of the gallery's portal, on the mezzanine.
  'standee-c': {
    width: 340, height: 800, layout: 'poster', tag: 'Gratis',
    headline: 'Entrá a la muestra', line: 'Una selección distinta cada día',
    points: ['Abrí cada obra y mirá su ficha', 'Guardá tus estampillas', 'Sacate una foto del museo'],
  },
  // The rest are spread through the museum (layout.ts says where).
  'hall-up': {
    width: 340, height: 800, layout: 'poster', tag: 'Primer piso',
    headline: 'Las obras están arriba', line: 'Subí por la escalera mecánica',
    points: ['Artistas de muchos países', 'Una selección distinta cada día'],
  },
  'cafe-door': {
    width: 340, height: 800, layout: 'poster',
    headline: 'Álbum del Mundial', line: 'Coleccioná estampillas',
    points: ['Recorré la muestra 3D', 'Descubrí la comunidad', 'Guardá las obras que te gustan'],
  },
  'cafe-wall': {
    width: 400, height: 600, layout: 'poster',
    headline: 'Explorá el Mundial', line: 'Artistas y obras de todo el mundo',
    points: ['Buscá por nombre, título o país', 'Filtrá por técnica', 'Cada artista abre su perfil'],
    path: '/explorar',
  },
  'aud-wall': {
    width: 400, height: 600, layout: 'poster',
    headline: 'Doná para que siga ocurriendo', line: 'Un proyecto autogestivo, hecho a pulmón',
    points: ['Sostiene la convocatoria, la muestra y la galería 3D'],
    path: '/donar',
  },
  landing: {
    width: 340, height: 800, layout: 'poster',
    headline: 'Mapa del Mundial', line: 'De dónde viene la comunidad',
    points: ['Cada país se pinta con sus collages', 'Tocá un país y mirá sus obras'],
  },
  'gallery-wall': {
    width: 400, height: 600, layout: 'poster', tag: 'Próximamente',
    headline: 'Jurado internacional', line: 'Va a evaluar cada obra recibida',
    points: ['Las elegidas, en la Gran Muestra Online', 'Las 30 mejores, en la revista'],
  },
}

/** The banner slots this module draws. */
export const BRANDED_BANNERS = Object.keys(SPECS)

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = src
  })
}

type Font = (size: number) => string

/** One run of text in a column: wrapped to the width, with a yellow square before it when it is a point. */
type Run = { text: string; size: number; color: string; lineHeight: number; gap: number; bullet?: boolean; maxLines?: number }

/**
 * Lays the runs down a column from `top` and returns where the column ends.
 * With `draw` false it only measures, so a caller can size it to fit first;
 * a word wider than the column then measures as never fitting.
 */
function column(context: CanvasRenderingContext2D, runs: Run[], x: number, top: number, width: number, font: Font, draw: boolean) {
  let y = top
  context.textAlign = 'left'
  context.textBaseline = 'alphabetic'
  for (const run of runs) {
    const indent = run.bullet ? run.size * 0.75 : 0
    context.font = font(run.size)
    const measure = (value: string) => context.measureText(value).width
    const lines = wrapByWidth(measure, run.text, width - indent).slice(0, run.maxLines ?? 4)
    if (!draw && lines.some((line) => measure(line) > width - indent)) return Infinity
    y += run.gap
    lines.forEach((line, index) => {
      const baseline = y + run.size * (0.86 + index * run.lineHeight)
      if (!draw) return
      if (run.bullet && index === 0) {
        const side = run.size * 0.3
        context.save()
        context.translate(x + side * 0.7, baseline - run.size * 0.36)
        context.rotate(0.18)
        context.fillStyle = BRAND.yellow
        context.fillRect(-side / 2, -side / 2, side, side)
        context.restore()
      }
      context.font = font(run.size)
      context.fillStyle = run.color
      context.fillText(line, x + indent, baseline)
    })
    y += run.size * (0.86 + (lines.length - 1) * run.lineHeight) + run.size * 0.2
  }
  return y
}

/** The largest scale, up to `most`, at which the runs fit between `top` and `bottom`: a narrow sheet fills with larger type. */
function fitScale(context: CanvasRenderingContext2D, runs: (scale: number) => Run[], x: number, top: number, bottom: number, width: number, font: Font, most = 1) {
  let scale = most
  while (scale > 0.55 && column(context, runs(scale), x, top, width, font, false) > bottom) scale -= 0.04
  return scale
}

/** One line of text, centred, shrunk until it fits the width. */
function fittedLine(context: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, size: number, font: Font, color: string, align: CanvasTextAlign) {
  let fontSize = size
  context.font = font(fontSize)
  while (fontSize > 10 && context.measureText(text).width > width) {
    fontSize -= 1
    context.font = font(fontSize)
  }
  context.fillStyle = color
  context.textAlign = align
  context.textBaseline = 'alphabetic'
  context.fillText(text, x, y)
}

/** A word on a little torn red label, stuck over a corner. */
function label(context: CanvasRenderingContext2D, text: string, right: number, middle: number, size: number, font: Font, unit: number) {
  const word = text.toUpperCase()
  context.font = font(size)
  const width = context.measureText(word).width + size * 1.1
  const height = size * 1.75
  const x = right - width
  const y = middle - height / 2
  tornSheet(context, { x, y, w: width, h: height, color: BRAND.red, seed: 21, unit: unit * 0.6, tilt: 0.05 }, () => {
    context.font = font(size)
    context.fillStyle = BRAND.paper
    context.textAlign = 'center'
    context.textBaseline = 'alphabetic'
    context.fillText(word, x + width / 2, y + height / 2 + size * 0.36)
  })
}

type Assets = { mark: HTMLImageElement | null; word: HTMLImageElement | null; long: HTMLImageElement | null }

// The logo's letters are cream with a dark shadow and no fill of their own, so it only reads on paper:
// it goes on the paper, and the blue sheet below carries the words in cream.
function drawPoster(context: CanvasRenderingContext2D, spec: Spec, assets: Assets, display: Font) {
  const { width: w, height: h } = spec
  const unit = Math.min(w, h) / 500
  paperGround(context, BRAND.paper, 2)
  // The globe over the wordmark, shrunk together on a squat poster so they stay clear of the sheet,
  // its tape and its label.
  const wordRatio = assets.word ? assets.word.naturalHeight / assets.word.naturalWidth : 0
  const room = h * 0.335
  const fit = Math.min(1, room / (Math.min(w * 0.44, h * 0.19) + h * 0.008 + w * 0.82 * wordRatio))
  const markSize = Math.min(w * 0.44, h * 0.19) * fit
  if (assets.mark) context.drawImage(assets.mark, (w - markSize) / 2, h * 0.035, markSize, markSize)
  if (assets.word) {
    const wordWidth = w * 0.82 * fit
    context.drawImage(assets.word, (w - wordWidth) / 2, h * 0.035 + markSize + h * 0.008, wordWidth, wordWidth * wordRatio)
  }
  const sheet = { x: w * 0.04, y: h * 0.42, w: w * 0.92, h: h * 0.485 }
  const pad = Math.max(w * 0.075, h * 0.04)
  const x = sheet.x + pad
  const width = sheet.w - pad * 2
  const runs = (scale: number): Run[] => [
    { text: spec.headline.toUpperCase(), size: w * 0.135 * scale, color: BRAND.paper, lineHeight: 0.98, gap: 0, maxLines: 3 },
    { text: spec.line, size: w * 0.064 * scale, color: BRAND.yellow, lineHeight: 1.1, gap: w * 0.012 * scale, maxLines: 2 },
    ...spec.points.map((point, index): Run => ({ text: point, size: w * 0.056 * scale, color: BRAND.paper, lineHeight: 1.12, gap: (index === 0 ? w * 0.05 : w * 0.018) * scale, bullet: true, maxLines: 3 })),
  ]
  const top = sheet.y + pad
  const scale = fitScale(context, runs, x, top, sheet.y + sheet.h - pad * 0.8, width, display, 1.8)
  tornSheet(context, { ...sheet, color: BRAND.blue, seed: 3, unit, tilt: -0.012 }, () => column(context, runs(scale), x, top, width, display, true))
  if (spec.tag) label(context, spec.tag, sheet.x + sheet.w + w * 0.015, sheet.y + h * 0.004, w * 0.065, display, unit)
  // Tape in the globe's colours: one across each held edge of the sheet, one loose by the logo.
  tape(context, { x: w * 0.2, y: sheet.y + h * 0.002, length: w * 0.3, width: h * 0.042, angle: -0.09, color: BRAND.yellow, seed: 8, unit })
  tape(context, { x: w * 0.78, y: sheet.y + sheet.h, length: w * 0.3, width: h * 0.042, angle: 0.07, color: BRAND.red, seed: 11, unit })
  tape(context, { x: w * 0.83, y: h * 0.05, length: w * 0.27, width: h * 0.048, angle: 0.06, color: BRAND.red, seed: 5, unit })
  fittedLine(context, `${BRAND_DOMAIN}${spec.path ?? ''}`, w / 2, h * 0.972, w * 0.9, w * 0.058, display, BRAND.ink, 'center')
}

/** A row of the site's sections in cream, with a yellow square between each and the next, shrunk to fit. */
function sectionRow(context: CanvasRenderingContext2D, items: string[], x: number, y: number, width: number, size: number, font: Font) {
  const words = items.map((item) => item.toUpperCase())
  let fontSize = size
  const total = () => {
    context.font = font(fontSize)
    return words.reduce((sum, word) => sum + context.measureText(word).width, 0) + (words.length - 1) * fontSize * 1.3
  }
  while (fontSize > 12 && total() > width) fontSize -= 1
  context.font = font(fontSize)
  context.textAlign = 'left'
  context.textBaseline = 'alphabetic'
  let at = x
  words.forEach((word, index) => {
    context.fillStyle = BRAND.paper
    context.fillText(word, at, y)
    at += context.measureText(word).width
    if (index === words.length - 1) return
    const side = fontSize * 0.28
    context.save()
    context.translate(at + fontSize * 0.65, y - fontSize * 0.36)
    context.rotate(0.18)
    context.fillStyle = BRAND.yellow
    context.fillRect(-side / 2, -side / 2, side, side)
    context.restore()
    at += fontSize * 1.3
  })
}

function drawLong(context: CanvasRenderingContext2D, spec: Spec, assets: Assets, display: Font) {
  const { width: w, height: h } = spec
  const unit = Math.min(w, h) / 500
  paperGround(context, BRAND.paper, 4)
  if (assets.long) {
    const logoWidth = w * 0.33
    const logoHeight = (logoWidth * assets.long.naturalHeight) / assets.long.naturalWidth
    context.drawImage(assets.long, w * 0.025, (h - logoHeight) / 2, logoWidth, logoHeight)
  }
  const sheet = { x: w * 0.38, y: h * 0.08, w: w * 0.6, h: h * 0.84 }
  const x = w * 0.46
  const width = w * 0.49
  const runs = (scale: number): Run[] => [
    { text: spec.headline.toUpperCase(), size: h * 0.155 * scale, color: BRAND.paper, lineHeight: 0.98, gap: 0, maxLines: 2 },
    { text: spec.line, size: h * 0.075 * scale, color: BRAND.yellow, lineHeight: 1.1, gap: h * 0.01 * scale, maxLines: 1 },
  ]
  const top = sheet.y + h * 0.1
  const scale = fitScale(context, runs, x, top, h * 0.6, width, display)
  tornSheet(context, { ...sheet, color: BRAND.blue, seed: 3, unit, tilt: 0.006 }, () => {
    column(context, runs(scale), x, top, width, display, true)
    sectionRow(context, spec.points, x, h * 0.72, width, h * 0.07, display)
    fittedLine(context, BRAND_DOMAIN, x, h * 0.85, width, h * 0.06, display, BRAND.yellow, 'left')
  })
  // Tape across the sheet's two left corners, holding it to the vinyl.
  tape(context, { x: w * 0.39, y: h * 0.17, length: w * 0.1, width: h * 0.1, angle: -0.55, color: BRAND.red, seed: 5, unit })
  tape(context, { x: w * 0.39, y: h * 0.83, length: w * 0.1, width: h * 0.1, angle: 0.5, color: BRAND.yellow, seed: 8, unit })
}

/**
 * The texture for a branded banner slot. It is returned at once, as plain
 * paper, and fills in once the logo has arrived (a few KB, cached by the CDN)
 * and Anton has loaded, so no word is ever set in a fallback face.
 */
export function brandBannerTexture(id: string): THREE.Texture | null {
  const spec = SPECS[id]
  if (!spec) return null
  const { canvas, context } = canvasOf(spec.width, spec.height)
  context.fillStyle = BRAND.paper
  context.fillRect(0, 0, spec.width, spec.height)
  const texture = canvasTexture(canvas, false)
  let alive = true
  const originalDispose = texture.dispose.bind(texture)
  texture.dispose = () => {
    alive = false
    originalDispose()
  }
  void (async () => {
    const face = canvasFonts(false).display
    const display: Font = (size) => `${Math.round(size)}px ${face}`
    const words = [spec.tag, spec.headline.toUpperCase(), spec.line, ...spec.points, BRAND_DOMAIN].join(' ')
    const [mark, word, long] = await Promise.all([
      loadImage(imageSrc('/logo-mark.png', 384)),
      loadImage(imageSrc('/wordmark.png', 640)),
      loadImage(imageSrc('/logo.png', 1200)),
      // A face nothing on the page has used yet is not fetched until asked for.
      document.fonts?.load(display(48), words).catch(() => null),
    ])
    // The signs all become ready at once; each draws in a task of its own (some
    // tens of ms on a phone), so together they never hold up a frame.
    await new Promise((resolve) => setTimeout(resolve, BRANDED_BANNERS.indexOf(id) * 60))
    if (!alive) return
    if (spec.layout === 'long') drawLong(context, spec, { mark, word, long }, display)
    else drawPoster(context, spec, { mark, word, long }, display)
    texture.needsUpdate = true
  })()
  return texture
}
