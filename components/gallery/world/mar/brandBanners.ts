import type * as THREE from 'three'
import { imageSrc } from '@/lib/image-src'
import { canvasFonts } from '../../fonts'
import { BRAND, BRAND_DOMAIN, wrapByWidth } from './brand'
import { canvasOf, canvasTexture, seeded } from './textures'

// The signs on the building, in the Mundial de Collage's identity: paper,
// torn-paper blocks in blue, red and yellow, the real logo, the site's Anton
// for headlines. They stand in for the banners that will be printed for the
// venue; a slot's own `image` (layout.ts) replaces any of them.

type Spec = {
  /** Canvas size, pixels. */
  width: number
  height: number
  /** Where the logo goes and which one: the globe above the wordmark, or the long logo. */
  layout: 'poster' | 'long'
  headline: string
  line: string
}

const SPECS: Record<string, Spec> = {
  'door-a': { width: 540, height: 990, layout: 'poster', headline: 'Recorré la exposición', line: 'Cada obra, una historia' },
  'door-b': { width: 360, height: 990, layout: 'poster', headline: 'Artistas de todo el mundo', line: 'Un Mundial de collage' },
  'door-c': { width: 510, height: 960, layout: 'poster', headline: 'Un archivo permanente', line: 'Cada edición queda online' },
  vinyl: { width: 2048, height: 516, layout: 'long', headline: 'Exposición internacional de collage', line: 'Obras de artistas de muchos países' },
  'standee-a': { width: 340, height: 800, layout: 'poster', headline: 'Entrá a la galería', line: 'Caminá la muestra' },
  'standee-b': { width: 340, height: 800, layout: 'poster', headline: 'Una página por obra', line: 'Conocé a cada artista' },
  'standee-c': { width: 340, height: 800, layout: 'poster', headline: 'Collage de todo el mundo', line: 'Un Mundial, muchas miradas' },
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

/**
 * A block of coloured paper with a hand-torn edge: the edge wanders a few
 * pixels either way, and a rim of the paper colour round it, as in the logo,
 * where the pieces are separated by white tears.
 */
export function tornBlock(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, seed: number) {
  const random = seeded(seed)
  const jitter = Math.max(3, Math.min(w, h) * 0.015)
  const step = Math.max(10, Math.min(w, h) / 14)
  // One outline, used for both the paper rim and the colour, so they line up.
  const points: Array<[number, number]> = []
  const edge = (x0: number, y0: number, x1: number, y1: number, horizontal: boolean) => {
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / step))
    for (let i = 0; i < n; i++) {
      const t = i / n
      const along = (random() - 0.5) * jitter
      const across = (random() - 0.5) * jitter * 2
      points.push([x0 + (x1 - x0) * t + (horizontal ? along : across), y0 + (y1 - y0) * t + (horizontal ? across : along)])
    }
  }
  edge(x, y, x + w, y, true)
  edge(x + w, y, x + w, y + h, false)
  edge(x + w, y + h, x, y + h, true)
  edge(x, y + h, x, y, false)
  const trace = () => {
    context.beginPath()
    points.forEach(([px, py], index) => (index === 0 ? context.moveTo(px, py) : context.lineTo(px, py)))
    context.closePath()
  }
  context.save()
  trace()
  context.lineJoin = 'round'
  context.lineWidth = Math.max(5, jitter * 2.2)
  context.strokeStyle = BRAND.paper
  context.stroke()
  context.fillStyle = color
  context.fill()
  context.restore()
}

function drawText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, font: (size: number) => string, size: number, lineHeight: number, color: string, align: CanvasTextAlign = 'left', maxLines = 3) {
  let fontSize = size
  const measure = (value: string) => {
    context.font = font(fontSize)
    return context.measureText(value).width
  }
  let lines = wrapByWidth(measure, text, maxWidth)
  while (lines.length > maxLines && fontSize > 14) {
    fontSize -= 2
    lines = wrapByWidth(measure, text, maxWidth)
  }
  context.font = font(fontSize)
  context.fillStyle = color
  context.textAlign = align
  context.textBaseline = 'alphabetic'
  lines.forEach((line, index) => context.fillText(line, x, y + index * fontSize * lineHeight))
  return y + lines.length * fontSize * lineHeight
}

type Assets = { mark: HTMLImageElement | null; word: HTMLImageElement | null; long: HTMLImageElement | null }

// The logo's letters are cream with a dark shadow and no fill of their own, so it only reads on paper:
// it goes on the paper, and the blue block below carries the headline in cream.
function drawPoster(context: CanvasRenderingContext2D, spec: Spec, assets: Assets, fonts: { display: string; body: string }) {
  const { width: w, height: h } = spec
  context.fillStyle = BRAND.paper
  context.fillRect(0, 0, w, h)
  // Torn pieces in the globe's colours, behind and beside the logo.
  tornBlock(context, w * 0.56, h * 0.02, w * 0.4, h * 0.08, BRAND.red, 5)
  tornBlock(context, w * 0.03, h * 0.31, w * 0.3, h * 0.06, BRAND.yellow, 8)
  const markSize = Math.min(w * 0.44, h * 0.19)
  if (assets.mark) context.drawImage(assets.mark, (w - markSize) / 2, h * 0.04, markSize, markSize)
  if (assets.word) {
    const wordWidth = w * 0.82
    const wordHeight = (wordWidth * assets.word.naturalHeight) / assets.word.naturalWidth
    context.drawImage(assets.word, (w - wordWidth) / 2, h * 0.04 + markSize + h * 0.01, wordWidth, wordHeight)
  }
  // The blue block, with the headline in Anton, cream on blue.
  tornBlock(context, w * 0.04, h * 0.44, w * 0.92, h * 0.46, BRAND.blue, 3)
  const display = (size: number) => `${size}px ${fonts.display}`
  const body = (size: number) => `600 ${size}px ${fonts.body}`
  const afterHead = drawText(context, spec.headline.toUpperCase(), w / 2, h * 0.55, w * 0.78, display, Math.round(w * 0.13), 1.05, BRAND.paper, 'center')
  drawText(context, spec.line, w / 2, afterHead + h * 0.012, w * 0.78, body, Math.round(w * 0.05), 1.25, BRAND.yellow, 'center')
  tornBlock(context, w * 0.62, h * 0.86, w * 0.3, h * 0.045, BRAND.red, 11)
  context.font = body(Math.round(w * 0.045))
  context.fillStyle = BRAND.ink
  context.textAlign = 'center'
  context.fillText(BRAND_DOMAIN, w / 2, h * 0.975)
}

function drawLong(context: CanvasRenderingContext2D, spec: Spec, assets: Assets, fonts: { display: string; body: string }) {
  const { width: w, height: h } = spec
  context.fillStyle = BRAND.paper
  context.fillRect(0, 0, w, h)
  if (assets.long) {
    const logoWidth = w * 0.33
    const logoHeight = (logoWidth * assets.long.naturalHeight) / assets.long.naturalWidth
    context.drawImage(assets.long, w * 0.025, (h - logoHeight) / 2, logoWidth, logoHeight)
  }
  tornBlock(context, w * 0.38, h * 0.08, w * 0.6, h * 0.84, BRAND.blue, 3)
  tornBlock(context, w * 0.34, h * 0.0, w * 0.07, h * 0.3, BRAND.red, 5)
  tornBlock(context, w * 0.35, h * 0.72, w * 0.08, h * 0.28, BRAND.yellow, 8)
  const display = (size: number) => `${size}px ${fonts.display}`
  const body = (size: number) => `600 ${size}px ${fonts.body}`
  const left = w * 0.46
  const afterHead = drawText(context, spec.headline.toUpperCase(), left, h * 0.33, w * 0.5, display, Math.round(h * 0.17), 1.05, BRAND.paper, 'left', 2)
  drawText(context, spec.line, left, afterHead + h * 0.02, w * 0.5, body, Math.round(h * 0.07), 1.25, BRAND.yellow, 'left', 2)
  context.font = body(Math.round(h * 0.06))
  context.fillStyle = BRAND.paper
  context.textAlign = 'left'
  context.fillText(BRAND_DOMAIN, left, h * 0.86)
}

/**
 * The texture for a branded banner slot. It is returned at once, as plain paper,
 * and fills in as the logo and the fonts arrive (a few KB, cached by the CDN).
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
    const [mark, word, long] = await Promise.all([
      loadImage(imageSrc('/logo-mark.png', 384)),
      loadImage(imageSrc('/wordmark.png', 640)),
      loadImage(imageSrc('/logo.png', 1200)),
      document.fonts?.ready,
    ])
    if (!alive) return
    const fonts = canvasFonts(false)
    if (spec.layout === 'long') drawLong(context, spec, { mark, word, long }, fonts)
    else drawPoster(context, spec, { mark, word, long }, fonts)
    texture.needsUpdate = true
  })()
  return texture
}
