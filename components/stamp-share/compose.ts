// The image to share a stamp of the album: an Instagram story (1080x1920)
// or a feed post (1080x1440, 3:4). It is meant to look like a real thing on
// a table, not like an app card: fibrous paper, scraps torn by hand and
// printed in halftone, an engraved stamp with thick perforations, its icon
// die-cut like a sticker, translucent tape, an uneven ink postmark and a
// sheet of little stamps for the progress. Drawn in the browser, so it costs
// the server nothing, and every stamp, language and count would otherwise be
// its own image to keep.
//
// Content keeps clear of Instagram's bars: nothing important in a story's
// top and bottom 200px.

export const STAMP_IMAGE_SIZES = {
  story: { width: 1080, height: 1920 },
  feed: { width: 1080, height: 1440 },
} as const

export type StampImageFormat = keyof typeof STAMP_IMAGE_SIZES

// Same brand values as lib/artwork-share-image.tsx and app/globals.css.
const PAPER = '#F4EFE4'
const INK = '#1B110C'
const RED = '#D4302E'
const BLUE = '#11458C'
const YELLOW = '#E79D00'
const KRAFT = '#CDAE7E'
const BONE = '#FBF8F0'
const POSTMARK_INK = '#2B2A4A'

// public/banner-mundial.png is 1290x388.
const BANNER_RATIO = 388 / 1290
const DEG = Math.PI / 180

export type StampImageText = {
  badge: string
  title: string
  body: string
  /** «Álbum del Mundial», along the stamp's foot. */
  album: string
  progress: string
  cta: string
  domain: string
  /** The postmark's date, already formatted. */
  date: string
}

export type StampImageInput = {
  format: StampImageFormat
  text: StampImageText
  /** The stamp's place in the album (1-based) and how many there are. */
  number: number
  total: number
  /** How many the person has: that many little stamps of the sheet are printed. */
  count: number
  tone: { paper: string; ink: string }
  /** The stamp's icon in the tone's ink, and the same icon thick in paper white for its die-cut edge. */
  icon: HTMLImageElement
  cutout: HTMLImageElement
  banner: HTMLImageElement
  fonts: { display: string; body: string }
}

type Layout = {
  bannerY: number
  bannerWidth: number
  badgeY: number
  badgeSize: number
  stampY: number
  stampWidth: number
  stampHeight: number
  sheetY: number
  sheetStamp: number
  progressY: number
  progressSize: number
  ctaY: number
  ctaHeight: number
  ctaSize: number
}

const LAYOUTS: Record<StampImageFormat, Layout> = {
  story: {
    bannerY: 175, bannerWidth: 620, badgeY: 432, badgeSize: 32,
    stampY: 962, stampWidth: 640, stampHeight: 760,
    sheetY: 1512, sheetStamp: 50, progressY: 1598, progressSize: 44,
    ctaY: 1624, ctaHeight: 140, ctaSize: 54,
  },
  feed: {
    bannerY: 50, bannerWidth: 480, badgeY: 246, badgeSize: 28,
    stampY: 680, stampWidth: 520, stampHeight: 600,
    sheetY: 1110, sheetStamp: 44, progressY: 1186, progressSize: 38,
    ctaY: 1220, ctaHeight: 128, ctaSize: 48,
  },
}

type Random = () => number

/** The same scraps and grain every time for the same stamp. */
function seeded(seed: number): Random {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  return canvas
}

// ---------------------------------------------------------------- textures

type Textures = { grain: CanvasPattern; blotch: CanvasPattern; fibers: CanvasPattern }

/** Per-pixel film grain, tiled: what keeps flat color from looking digital. */
function makeGrain(context: CanvasRenderingContext2D, random: Random) {
  const tile = makeCanvas(256, 256)
  const tileContext = tile.getContext('2d')!
  const data = tileContext.createImageData(256, 256)
  for (let i = 0; i < data.data.length; i += 4) {
    const value = 128 + (random() - 0.5) * 150
    data.data[i] = data.data[i + 1] = data.data[i + 2] = value
    data.data[i + 3] = 255
  }
  tileContext.putImageData(data, 0, 0)
  return context.createPattern(tile, 'repeat')!
}

/** Soft uneven patches (smoothed random noise in three sizes), like paper that was never perfectly even. */
function makeBlotch(context: CanvasRenderingContext2D, random: Random) {
  const size = 512
  const tile = makeCanvas(size, size)
  const tileContext = tile.getContext('2d')!
  tileContext.fillStyle = '#808080'
  tileContext.fillRect(0, 0, size, size)
  for (const [cells, alpha] of [[6, 0.5], [18, 0.35], [56, 0.22]] as const) {
    const small = makeCanvas(cells, cells)
    const smallContext = small.getContext('2d')!
    const data = smallContext.createImageData(cells, cells)
    for (let i = 0; i < data.data.length; i += 4) {
      const value = random() * 255
      data.data[i] = data.data[i + 1] = data.data[i + 2] = value
      data.data[i + 3] = 255
    }
    smallContext.putImageData(data, 0, 0)
    tileContext.globalAlpha = alpha
    tileContext.imageSmoothingEnabled = true
    tileContext.imageSmoothingQuality = 'high'
    tileContext.drawImage(small, 0, 0, size, size)
  }
  return context.createPattern(tile, 'repeat')!
}

/** Short pale and dark threads, the fibers of handmade paper. */
function makeFibers(context: CanvasRenderingContext2D, random: Random) {
  const size = 600
  const tile = makeCanvas(size, size)
  const tileContext = tile.getContext('2d')!
  tileContext.lineCap = 'round'
  for (let i = 0; i < 520; i++) {
    const x = random() * size
    const y = random() * size
    const length = 8 + random() * 26
    const angle = random() * Math.PI * 2
    tileContext.strokeStyle = random() < 0.55 ? 'rgba(255, 255, 255, 0.55)' : 'rgba(92, 64, 34, 0.28)'
    tileContext.lineWidth = 0.6 + random() * 0.9
    tileContext.beginPath()
    tileContext.moveTo(x, y)
    tileContext.quadraticCurveTo(x + Math.cos(angle + 0.8) * length * 0.5, y + Math.sin(angle + 0.8) * length * 0.5, x + Math.cos(angle) * length, y + Math.sin(angle) * length)
    tileContext.stroke()
  }
  return context.createPattern(tile, 'repeat')!
}

/** Lays the paper textures over whatever `path` (in the current transform) holds. */
function textured(context: CanvasRenderingContext2D, textures: Textures, path: Path2D | null, area: { x: number; y: number; w: number; h: number }, strength = 1) {
  context.save()
  if (path) context.clip(path)
  const layers: [CanvasPattern, GlobalCompositeOperation, number][] = [
    [textures.blotch, 'soft-light', 0.55 * strength],
    [textures.grain, 'overlay', 0.34 * strength],
    [textures.fibers, 'source-over', 0.7 * strength],
  ]
  for (const [pattern, mode, alpha] of layers) {
    context.globalCompositeOperation = mode
    context.globalAlpha = alpha
    context.fillStyle = pattern
    context.fillRect(area.x, area.y, area.w, area.h)
  }
  context.restore()
}

/** Printed halftone: a grid of pale dots tilted 15° over the color, as in a magazine page. */
function halftone(context: CanvasRenderingContext2D, area: { x: number; y: number; w: number; h: number }, dot: number) {
  context.save()
  context.translate(area.x + area.w / 2, area.y + area.h / 2)
  context.rotate(15 * DEG)
  context.fillStyle = 'rgba(255, 255, 255, 0.13)'
  const reach = Math.hypot(area.w, area.h) / 2
  const step = dot * 2.6
  for (let y = -reach; y < reach; y += step) {
    for (let x = -reach; x < reach; x += step) {
      context.beginPath()
      context.arc(x + (Math.round(y / step) % 2 ? step / 2 : 0), y, dot * 0.55, 0, Math.PI * 2)
      context.fill()
    }
  }
  context.restore()
}

// ---------------------------------------------------------------- compose

export function composeStampImage(input: StampImageInput): HTMLCanvasElement | null {
  const { width, height } = STAMP_IMAGE_SIZES[input.format]
  const layout = LAYOUTS[input.format]
  const canvas = makeCanvas(width, height)
  const context = canvas.getContext('2d')
  if (!context) return null
  const random = seeded(input.number * 7919 + (input.format === 'story' ? 1 : 2))
  const textures: Textures = { grain: makeGrain(context, random), blotch: makeBlotch(context, random), fibers: makeFibers(context, random) }
  const center = width / 2

  drawPaper(context, textures, width, height)
  drawScraps(context, textures, random, input.format, width, height)

  const bannerHeight = Math.round(layout.bannerWidth * BANNER_RATIO)
  context.save()
  context.shadowColor = 'rgba(27, 17, 12, 0.18)'
  context.shadowBlur = 10
  context.shadowOffsetY = 4
  context.drawImage(input.banner, center - layout.bannerWidth / 2, layout.bannerY, layout.bannerWidth, bannerHeight)
  context.restore()
  drawLabel(context, textures, random, input.text.badge, center, layout.badgeY, layout.badgeSize, input.fonts.body)

  // Kraft paper under the stamp, torn, turned the other way.
  context.save()
  context.translate(center + 16, layout.stampY + 12)
  context.rotate(4 * DEG)
  tornRect(context, textures, random, -layout.stampWidth / 2 - 54, -layout.stampHeight / 2 - 44, layout.stampWidth + 108, layout.stampHeight + 88, KRAFT, false)
  context.restore()

  const stamp = drawStamp(input, layout, textures, random)
  context.save()
  context.translate(center, layout.stampY)
  context.rotate(-3 * DEG)
  // Two shadows: a tight one where the paper touches, a long soft one.
  context.shadowColor = 'rgba(27, 17, 12, 0.45)'
  context.shadowBlur = 7
  context.shadowOffsetY = 4
  context.drawImage(stamp, -layout.stampWidth / 2, -layout.stampHeight / 2)
  context.shadowColor = 'rgba(27, 17, 12, 0.28)'
  context.shadowBlur = 40
  context.shadowOffsetY = 22
  context.drawImage(stamp, -layout.stampWidth / 2, -layout.stampHeight / 2)
  context.shadowColor = 'transparent'
  for (const side of [-1, 1]) {
    context.save()
    context.translate(side * (layout.stampWidth / 2 - 40), -layout.stampHeight / 2 + 6)
    context.rotate(side * 36 * DEG)
    drawTape(context, random, 200, 56)
    context.restore()
  }
  context.restore()

  // Mostly on the kraft, past the stamp's corner: it never covers its words.
  drawPostmark(context, input, random, center + layout.stampWidth / 2 + 6, layout.stampY + layout.stampHeight / 2 + 18, input.format === 'story' ? 112 : 94)
  drawSheet(context, input, random, center, layout.sheetY, layout.sheetStamp)

  context.fillStyle = INK
  context.textAlign = 'center'
  context.textBaseline = 'alphabetic'
  context.font = `700 ${layout.progressSize}px ${input.fonts.body}`
  context.fillText(input.text.progress, center, layout.progressY, width - 140)

  drawCta(context, textures, random, input, center, layout)

  // The whole picture, like a photo of the table: the corners fall into shade.
  const vignette = context.createRadialGradient(center, height / 2, Math.min(width, height) * 0.45, center, height / 2, Math.hypot(width, height) / 2)
  vignette.addColorStop(0, 'rgba(60, 38, 18, 0)')
  vignette.addColorStop(1, 'rgba(60, 38, 18, 0.22)')
  context.fillStyle = vignette
  context.fillRect(0, 0, width, height)
  return canvas
}

function drawPaper(context: CanvasRenderingContext2D, textures: Textures, width: number, height: number) {
  context.fillStyle = PAPER
  context.fillRect(0, 0, width, height)
  textured(context, textures, null, { x: 0, y: 0, w: width, h: height }, 1.1)
}

// Torn colored paper at the edges, printed in halftone, like the scraps
// around an obra.
function drawScraps(context: CanvasRenderingContext2D, textures: Textures, random: Random, format: StampImageFormat, width: number, height: number) {
  const scraps: [number, number, number, number, number, string][] = format === 'story'
    ? [
        [width - 250, -60, 380, 300, 12, YELLOW],
        [-90, height - 330, 420, 340, -9, BLUE],
        [-60, 760, 150, 420, 6, RED],
        [width - 110, 1180, 190, 330, -7, BLUE],
      ]
    : [
        [width - 210, -70, 330, 230, 12, YELLOW],
        [-80, height - 210, 360, 260, -8, BLUE],
        [-70, 520, 140, 330, 6, RED],
      ]
  for (const [x, y, w, h, angle, color] of scraps) {
    context.save()
    context.translate(x + w / 2, y + h / 2)
    context.rotate(angle * DEG)
    tornRect(context, textures, random, -w / 2, -h / 2, w, h, color, true)
    context.restore()
  }
}

/** The outline of a sheet torn by hand: a ragged edge that wanders instead of jittering. */
function tornPath(random: Random, x: number, y: number, w: number, h: number, roughness: number) {
  const step = 11
  const wander = (length: number) => {
    const offsets: number[] = []
    let drift = 0
    for (let i = 0; i <= length / step; i++) {
      drift = drift * 0.82 + (random() - 0.5) * roughness
      offsets.push(drift + (random() - 0.5) * roughness * 0.7)
    }
    return offsets
  }
  const top = wander(w), right = wander(h), bottom = wander(w), left = wander(h)
  const path = new Path2D()
  top.forEach((o, i) => { const px = x + i * step; if (i) path.lineTo(px, y + o); else path.moveTo(px, y + o) })
  right.forEach((o, i) => path.lineTo(x + w + o, y + i * step))
  bottom.forEach((o, i) => path.lineTo(x + w - i * step, y + h + o))
  left.forEach((o, i) => path.lineTo(x + o, y + h - i * step))
  path.closePath()
  return path
}

/** A rectangle of paper torn by hand, with the pale fiber of the tear showing at the edge. */
function tornRect(context: CanvasRenderingContext2D, textures: Textures, random: Random, x: number, y: number, w: number, h: number, color: string, printed: boolean) {
  const edge = tornPath(random, x, y, w, h, 9)
  const body = tornPath(random, x + 3, y + 3, w - 6, h - 6, 7)
  context.save()
  context.shadowColor = 'rgba(27, 17, 12, 0.34)'
  context.shadowBlur = 16
  context.shadowOffsetY = 7
  context.fillStyle = BONE
  context.fill(edge)
  context.restore()
  textured(context, textures, edge, { x: x - 20, y: y - 20, w: w + 40, h: h + 40 }, 0.9)
  context.fillStyle = color
  context.fill(body)
  if (printed) {
    context.save()
    context.clip(body)
    halftone(context, { x, y, w, h }, 3.4)
    context.restore()
  }
  textured(context, textures, body, { x: x - 20, y: y - 20, w: w + 40, h: h + 40 }, 1.15)
  // A little lit lip along the tear, as a thick sheet shows when it is ripped.
  context.save()
  context.strokeStyle = 'rgba(255, 255, 255, 0.5)'
  context.lineWidth = 2
  context.stroke(body)
  context.restore()
}

function drawTape(context: CanvasRenderingContext2D, random: Random, w: number, h: number) {
  const path = new Path2D()
  path.moveTo(-w / 2, -h / 2)
  for (let i = 0; i <= 8; i++) path.lineTo(-w / 2 + (w * i) / 8, -h / 2 + (random() - 0.5) * 3)
  for (let i = 1; i <= 6; i++) path.lineTo(w / 2 + (random() - 0.5) * 12, -h / 2 + (h * i) / 6)
  for (let i = 8; i >= 0; i--) path.lineTo(-w / 2 + (w * i) / 8, h / 2 + (random() - 0.5) * 3)
  for (let i = 5; i >= 1; i--) path.lineTo(-w / 2 + (random() - 0.5) * 12, -h / 2 + (h * i) / 6)
  path.closePath()
  context.save()
  context.shadowColor = 'rgba(27, 17, 12, 0.28)'
  context.shadowBlur = 6
  context.shadowOffsetY = 3
  // Translucent: what is under it shows through, a little yellowed.
  const body = context.createLinearGradient(0, -h / 2, 0, h / 2)
  body.addColorStop(0, 'rgba(236, 207, 132, 0.78)')
  body.addColorStop(0.5, 'rgba(244, 222, 160, 0.62)')
  body.addColorStop(1, 'rgba(226, 192, 112, 0.8)')
  context.fillStyle = body
  context.fill(path)
  context.restore()
  context.save()
  context.clip(path)
  // The shine of the plastic and the faint lines of its backing.
  context.fillStyle = 'rgba(255, 255, 255, 0.28)'
  context.fillRect(-w / 2, -h / 2 + 5, w, 6)
  context.strokeStyle = 'rgba(120, 84, 24, 0.10)'
  context.lineWidth = 1
  for (let x = -w / 2; x < w / 2; x += 7) {
    context.beginPath()
    context.moveTo(x, -h / 2)
    context.lineTo(x + (random() - 0.5) * 3, h / 2)
    context.stroke()
  }
  context.restore()
}

/** The stamp on its own canvas, so its perforation can punch real holes. */
function drawStamp(input: StampImageInput, layout: Layout, textures: Textures, random: Random) {
  const { stampWidth: w, stampHeight: h } = layout
  const canvas = makeCanvas(w, h)
  const context = canvas.getContext('2d')!
  context.fillStyle = BONE
  context.fillRect(0, 0, w, h)
  textured(context, textures, null, { x: 0, y: 0, w, h }, 0.9)

  const inset = w * 0.065
  const panel = { x: inset, y: inset, w: w - inset * 2, h: h - inset * 2 }
  const { paper, ink } = input.tone

  // The engraved field: the color, a sunburst of fine lines and rings.
  context.fillStyle = paper
  context.fillRect(panel.x, panel.y, panel.w, panel.h)
  context.save()
  context.beginPath()
  context.rect(panel.x, panel.y, panel.w, panel.h)
  context.clip()
  const focus = { x: w / 2, y: panel.y + panel.h * 0.36 }
  context.strokeStyle = ink
  context.globalAlpha = 0.13
  context.lineWidth = 1.2
  for (let i = 0; i < 150; i++) {
    const angle = (i / 150) * Math.PI * 2
    context.beginPath()
    context.moveTo(focus.x + Math.cos(angle) * panel.w * 0.3, focus.y + Math.sin(angle) * panel.w * 0.3)
    context.lineTo(focus.x + Math.cos(angle) * panel.h, focus.y + Math.sin(angle) * panel.h)
    context.stroke()
  }
  context.globalAlpha = 0.2
  for (let r = panel.w * 0.2; r < panel.w * 0.38; r += 6) {
    context.beginPath()
    context.arc(focus.x, focus.y, r, 0, Math.PI * 2)
    context.stroke()
  }
  // A paper disc for the icon, as in a printed vignette.
  context.globalAlpha = 0.16
  context.fillStyle = ink
  context.beginPath()
  context.arc(focus.x, focus.y, panel.w * 0.3, 0, Math.PI * 2)
  context.fill()
  context.restore()

  // The printed frame, a double line a little inside the edge.
  context.save()
  context.strokeStyle = ink
  context.globalAlpha = 0.55
  context.lineWidth = 2.5
  context.strokeRect(panel.x + 12, panel.y + 12, panel.w - 24, panel.h - 24)
  context.lineWidth = 1
  context.strokeRect(panel.x + 19, panel.y + 19, panel.w - 38, panel.h - 38)
  context.restore()

  const display = input.fonts.display
  const body = input.fonts.body

  // The stamp's number, where a postage stamp has its value.
  context.fillStyle = ink
  context.textBaseline = 'alphabetic'
  context.textAlign = 'left'
  const numberSize = w * 0.1
  context.font = `${numberSize}px ${display}`
  const number = String(input.number).padStart(2, '0')
  context.fillText(number, panel.x + w * 0.065, panel.y + numberSize * 1.55)
  const numberWidth = context.measureText(number).width
  context.font = `700 ${numberSize * 0.36}px ${body}`
  context.globalAlpha = 0.75
  context.fillText(`/${input.total}`, panel.x + w * 0.065 + numberWidth + 6, panel.y + numberSize * 1.55)
  context.globalAlpha = 1

  // The icon, die-cut: a thick paper-white edge around it, lifted off the page.
  const iconSize = panel.w * 0.46
  const iconX = focus.x - iconSize / 2
  const iconY = focus.y - iconSize / 2
  context.save()
  context.shadowColor = 'rgba(0, 0, 0, 0.45)'
  context.shadowBlur = 14
  context.shadowOffsetX = 5
  context.shadowOffsetY = 8
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2
    context.drawImage(input.cutout, iconX + Math.cos(angle) * 6, iconY + Math.sin(angle) * 6, iconSize, iconSize)
  }
  context.restore()
  context.drawImage(input.icon, iconX, iconY, iconSize, iconSize)

  // Title: one line if it fits, else two, shrinking until it does. Pressed
  // in with a hard offset ink, as letterpress is.
  context.textAlign = 'center'
  const maxWidth = panel.w - w * 0.16
  const titleLines = fitLines(context, input.text.title.toUpperCase(), display, '', maxWidth, w * 0.13, 2)
  let y = panel.y + panel.h * 0.7
  context.font = `${titleLines.size}px ${display}`
  titleLines.lines.forEach((line, index) => {
    const lineY = y + index * titleLines.size * 1.02
    context.fillStyle = 'rgba(0, 0, 0, 0.28)'
    context.fillText(line, w / 2 + 2.5, lineY + 2.5, maxWidth)
    context.fillStyle = ink
    context.fillText(line, w / 2, lineY, maxWidth)
  })
  y += (titleLines.lines.length - 1) * titleLines.size * 1.02 + w * 0.065
  const bodyLines = fitLines(context, input.text.body, body, '700 ', maxWidth, w * 0.046, 2)
  context.font = `700 ${bodyLines.size}px ${body}`
  context.fillStyle = ink
  context.globalAlpha = 0.9
  bodyLines.lines.forEach((line, index) => context.fillText(line, w / 2, y + index * bodyLines.size * 1.2, maxWidth))
  context.globalAlpha = 1

  // «Álbum del Mundial» along the foot.
  context.font = `700 ${w * 0.03}px ${body}`
  if ('letterSpacing' in context) context.letterSpacing = `${w * 0.006}px`
  context.globalAlpha = 0.75
  context.fillText(input.text.album.toUpperCase(), w / 2, panel.y + panel.h - w * 0.052, maxWidth)
  context.globalAlpha = 1
  if ('letterSpacing' in context) context.letterSpacing = '0px'

  // Worn ink: specks where the print did not take, so the color is never flat.
  context.save()
  context.globalCompositeOperation = 'source-atop'
  for (let i = 0; i < 900; i++) {
    context.fillStyle = random() < 0.7 ? 'rgba(251, 248, 240, 0.32)' : 'rgba(0, 0, 0, 0.14)'
    const size = 0.8 + random() * 2.4
    context.fillRect(panel.x + random() * panel.w, panel.y + random() * panel.h, size, size)
  }
  textured(context, textures, null, { x: 0, y: 0, w, h }, 0.8)
  // A soft sheen from the top-left, a little shade to the bottom-right: the paper is not quite flat.
  const sheen = context.createLinearGradient(0, 0, w, h)
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.2)')
  sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0)')
  sheen.addColorStop(1, 'rgba(0, 0, 0, 0.16)')
  context.fillStyle = sheen
  context.fillRect(0, 0, w, h)
  context.restore()

  // Perforation: real holes through the paper, with a shaded rim for its thickness.
  const radius = w * 0.022
  const gap = radius * 2.9
  const holes: [number, number][] = []
  for (let x = gap / 2; x < w; x += gap) holes.push([x, 0], [x, h])
  for (let y = gap / 2; y < h; y += gap) holes.push([0, y], [w, y])
  context.globalCompositeOperation = 'destination-out'
  for (const [x, y] of holes) { context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill() }
  context.globalCompositeOperation = 'source-atop'
  context.strokeStyle = 'rgba(92, 64, 34, 0.45)'
  context.lineWidth = 2.2
  for (const [x, y] of holes) { context.beginPath(); context.arc(x, y, radius + 1.2, 0, Math.PI * 2); context.stroke() }
  context.globalCompositeOperation = 'source-over'
  return canvas
}

/** Words into at most `maxLines` lines at the biggest size (down from `size`) where they fit. */
export function fitLines(context: CanvasRenderingContext2D, text: string, family: string, weight: string, maxWidth: number, size: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean)
  for (let current = size; current > 12; current -= 2) {
    context.font = `${weight}${current}px ${family}`
    const lines: string[] = []
    for (const word of words) {
      const last = lines.at(-1)
      if (last !== undefined && context.measureText(`${last} ${word}`).width <= maxWidth) lines[lines.length - 1] = `${last} ${word}`
      else lines.push(word)
    }
    if (lines.length <= maxLines && lines.every((line) => context.measureText(line).width <= maxWidth)) return { lines, size: current }
  }
  return { lines: [text], size: 12 }
}

/** A strip of red paper with torn ends, stuck on crooked: «Logro desbloqueado». */
function drawLabel(context: CanvasRenderingContext2D, textures: Textures, random: Random, label: string, x: number, y: number, fontSize: number, font: string) {
  context.save()
  context.font = `700 ${fontSize}px ${font}`
  if ('letterSpacing' in context) context.letterSpacing = `${fontSize * 0.12}px`
  const text = label.toUpperCase()
  const boxWidth = context.measureText(text).width + fontSize * 2
  const boxHeight = fontSize * 1.9
  context.translate(x, y)
  context.rotate(-2 * DEG)
  tornRect(context, textures, random, -boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, RED, true)
  context.fillStyle = BONE
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text, 0, 2)
  context.restore()
}

/**
 * A round postmark in uneven ink: pressed harder at one side, with specks
 * where the rubber did not touch and cancel lines that wobble. Stamped with
 * multiply, so the paper and the stamp show through it.
 */
function drawPostmark(context: CanvasRenderingContext2D, input: StampImageInput, random: Random, x: number, y: number, radius: number) {
  const size = Math.ceil(radius * 6)
  const mark = makeCanvas(size, size)
  const ink = mark.getContext('2d')!
  ink.translate(size / 2 + radius * 1.2, size / 2)
  ink.strokeStyle = POSTMARK_INK
  ink.fillStyle = POSTMARK_INK
  ink.lineCap = 'round'
  ink.lineWidth = radius * 0.06
  ink.beginPath()
  ink.arc(0, 0, radius, 0, Math.PI * 2)
  ink.stroke()
  ink.lineWidth = radius * 0.035
  ink.beginPath()
  ink.arc(0, 0, radius * 0.72, 0, Math.PI * 2)
  ink.stroke()

  // The brand around the ring.
  const label = 'MUNDIAL DE COLLAGE ★ '
  ink.font = `700 ${radius * 0.15}px ${input.fonts.body}`
  ink.textAlign = 'center'
  ink.textBaseline = 'middle'
  const step = (Math.PI * 2) / label.length
  for (let i = 0; i < label.length; i++) {
    ink.save()
    ink.rotate(i * step)
    ink.translate(0, -radius * 0.86)
    ink.fillText(label[i], 0, 0)
    ink.restore()
  }
  ink.font = `${radius * 0.27}px ${input.fonts.display}`
  ink.fillText(input.text.date, 0, 2, radius * 1.3)

  // Cancel waves to the left, each a little different, like a roller's.
  ink.lineWidth = radius * 0.05
  for (let line = 0; line < 4; line++) {
    const offset = (line - 1.5) * radius * 0.21
    ink.beginPath()
    const phase = random() * 2
    for (let i = 0; i <= 22; i++) {
      const px = -radius * 1.1 - i * radius * 0.085
      const py = offset + Math.sin(i * 0.6 + phase) * radius * (0.07 + random() * 0.025)
      if (i) ink.lineTo(px, py)
      else ink.moveTo(px, py)
    }
    ink.stroke()
  }

  // Uneven pressure and specks: wear the mark away.
  ink.globalCompositeOperation = 'destination-out'
  const fade = ink.createLinearGradient(-radius * 1.5, -radius, radius * 1.2, radius)
  fade.addColorStop(0, 'rgba(0, 0, 0, 0.05)')
  fade.addColorStop(1, 'rgba(0, 0, 0, 0.3)')
  ink.fillStyle = fade
  ink.fillRect(-size, -size, size * 2, size * 2)
  for (let i = 0; i < 520; i++) {
    ink.fillStyle = `rgba(0, 0, 0, ${0.4 + random() * 0.6})`
    const dot = 0.7 + random() * 2.4
    ink.beginPath()
    ink.arc((random() - 0.4) * radius * 4.4, (random() - 0.5) * radius * 2.4, dot, 0, Math.PI * 2)
    ink.fill()
  }

  context.save()
  context.translate(x, y)
  context.rotate(10 * DEG)
  context.globalCompositeOperation = 'multiply'
  context.globalAlpha = 0.9
  context.drawImage(mark, -size / 2 - radius * 1.2, -size / 2)
  context.restore()
}

/** A mini perforated stamp: printed when it has been earned, an empty outline on the sheet when it has not. */
function miniStamp(context: CanvasRenderingContext2D, x: number, y: number, size: number, tilt: number, color: string | null) {
  const w = size
  const h = size * 1.22
  context.save()
  context.translate(x, y)
  context.rotate(tilt)
  const radius = w * 0.075
  const gap = radius * 2.9
  const outline = new Path2D()
  outline.rect(-w / 2, -h / 2, w, h)
  const holes = new Path2D()
  for (let px = -w / 2 + gap / 2; px < w / 2; px += gap) {
    holes.moveTo(px + radius, -h / 2); holes.arc(px, -h / 2, radius, 0, Math.PI * 2)
    holes.moveTo(px + radius, h / 2); holes.arc(px, h / 2, radius, 0, Math.PI * 2)
  }
  for (let py = -h / 2 + gap / 2; py < h / 2; py += gap) {
    holes.moveTo(-w / 2 + radius, py); holes.arc(-w / 2, py, radius, 0, Math.PI * 2)
    holes.moveTo(w / 2 + radius, py); holes.arc(w / 2, py, radius, 0, Math.PI * 2)
  }

  if (color) {
    const pad = 4
    const layer = makeCanvas(w + pad * 2, h + pad * 2)
    const layerContext = layer.getContext('2d')!
    layerContext.translate((w + pad * 2) / 2, (h + pad * 2) / 2)
    layerContext.fillStyle = BONE
    layerContext.fill(outline)
    const inner = w * 0.12
    layerContext.fillStyle = color
    layerContext.fillRect(-w / 2 + inner, -h / 2 + inner, w - inner * 2, h - inner * 2)
    // Enough engraving to read as printed: a ring and a star.
    layerContext.strokeStyle = 'rgba(251, 248, 240, 0.7)'
    layerContext.lineWidth = 1.6
    layerContext.beginPath()
    layerContext.arc(0, -h * 0.04, w * 0.22, 0, Math.PI * 2)
    layerContext.stroke()
    layerContext.fillStyle = 'rgba(251, 248, 240, 0.85)'
    layerContext.font = `${w * 0.3}px sans-serif`
    layerContext.textAlign = 'center'
    layerContext.textBaseline = 'middle'
    layerContext.fillText('★', 0, -h * 0.03)
    layerContext.globalCompositeOperation = 'destination-out'
    layerContext.fill(holes)
    context.shadowColor = 'rgba(27, 17, 12, 0.4)'
    context.shadowBlur = 5
    context.shadowOffsetY = 3
    context.drawImage(layer, -(w + pad * 2) / 2, -(h + pad * 2) / 2)
  } else {
    context.globalAlpha = 0.9
    context.strokeStyle = 'rgba(27, 17, 12, 0.55)'
    context.lineWidth = 1.8
    context.setLineDash([3, 4])
    context.stroke(outline)
    context.setLineDash([])
    context.fillStyle = 'rgba(27, 17, 12, 0.06)'
    context.fillRect(-w / 2, -h / 2, w, h)
  }
  context.restore()
}

/** The progress as a sheet of stamps: the ones the person has are printed, the rest are still blank. */
function drawSheet(context: CanvasRenderingContext2D, input: StampImageInput, random: Random, center: number, y: number, size: number) {
  const total = input.total
  const gap = size * 0.2
  const width = total * size + (total - 1) * gap
  const colors = [RED, YELLOW, BLUE]
  for (let i = 0; i < total; i++) {
    const x = center - width / 2 + size / 2 + i * (size + gap)
    miniStamp(context, x, y + (random() - 0.5) * 4, size, ((i % 3) - 1) * 2.5 * DEG + (random() - 0.5) * 0.03, i < input.count ? colors[i % colors.length] : null)
  }
}

function drawCta(context: CanvasRenderingContext2D, textures: Textures, random: Random, input: StampImageInput, center: number, layout: Layout) {
  const width = STAMP_IMAGE_SIZES[input.format].width - 200
  context.save()
  context.translate(center, layout.ctaY + layout.ctaHeight / 2)
  context.rotate(1 * DEG)
  tornRect(context, textures, random, -width / 2, -layout.ctaHeight / 2, width, layout.ctaHeight, BLUE, true)
  context.fillStyle = BONE
  context.textAlign = 'center'
  context.textBaseline = 'alphabetic'
  const cta = fitLines(context, input.text.cta.toUpperCase(), input.fonts.display, '', width - 60, layout.ctaSize, 1)
  context.font = `${cta.size}px ${input.fonts.display}`
  context.fillText(cta.lines[0], 0, -layout.ctaHeight * 0.06, width - 60)
  context.globalAlpha = 0.9
  context.font = `700 ${layout.ctaSize * 0.6}px ${input.fonts.body}`
  context.fillText(input.text.domain, 0, layout.ctaHeight * 0.34, width - 60)
  context.restore()
}

/** A lucide icon from the page, as an image the canvas can draw in `color` with a given line width. */
export function svgImage(svg: SVGSVGElement, color: string, size: number, strokeWidth: number): Promise<HTMLImageElement> {
  const copy = svg.cloneNode(true) as SVGSVGElement
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  copy.setAttribute('width', String(size))
  copy.setAttribute('height', String(size))
  copy.setAttribute('stroke', color)
  copy.setAttribute('color', color)
  copy.setAttribute('stroke-width', String(strokeWidth))
  copy.setAttribute('stroke-linecap', 'round')
  copy.setAttribute('stroke-linejoin', 'round')
  copy.removeAttribute('class')
  const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('icon'))
    image.src = source
  })
}

let bannerPromise: Promise<HTMLImageElement> | null = null
export function loadBanner() {
  bannerPromise ??= new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => {
      bannerPromise = null
      reject(new Error('banner'))
    }
    image.src = '/banner-mundial.png'
  })
  return bannerPromise
}
