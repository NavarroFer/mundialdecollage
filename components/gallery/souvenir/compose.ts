// The souvenir photo: what the visitor sees in the 3D gallery, taped onto
// an Instagram story (1080x1920) dressed like the obras' own story image
// (lib/artwork-share-image.tsx) — same paper, banner, red badge and margins
// that keep clear of Instagram's bars. Drawn in the browser, since the photo
// only exists there.

export const SOUVENIR_SIZE = { width: 1080, height: 1920 }

// Same brand values as lib/artwork-share-image.tsx.
const PAPER = '#FAF8F2'
const INK = '#1B110C'
const RED = '#D4302E'
const WHITE = '#FFFFFF'
const TAPE = 'rgba(228, 184, 74, 0.82)'

// public/banner-mundial.png is 1290x388.
const BANNER_RATIO = 388 / 1290
const PHOTO = 860
const PHOTO_PADDING = 26
const TILT = (-2 * Math.PI) / 180

type Crop = { sx: number; sy: number; sw: number; sh: number }

/** The centered part of a `width`x`height` picture that fills a frame of `ratio` (width / height). */
export function coverCrop(width: number, height: number, ratio: number): Crop {
  if (width / height > ratio) {
    const sw = height * ratio
    return { sx: (width - sw) / 2, sy: 0, sw, sh: height }
  }
  const sh = width / ratio
  return { sx: 0, sy: (height - sh) / 2, sw: width, sh }
}

export type SouvenirText = { badge: string; headline: string; caption: string; domain: string }
export type SouvenirFonts = { display: string; body: string }

export function composeSouvenir(shot: HTMLCanvasElement, banner: HTMLImageElement, text: SouvenirText, fonts: SouvenirFonts) {
  const { width, height } = SOUVENIR_SIZE
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return null
  const center = width / 2

  context.fillStyle = PAPER
  context.fillRect(0, 0, width, height)

  const bannerWidth = 640
  const bannerHeight = Math.round(bannerWidth * BANNER_RATIO)
  context.drawImage(banner, center - bannerWidth / 2, 170, bannerWidth, bannerHeight)

  drawBadge(context, text.badge, center, 170 + bannerHeight + 70, fonts.body)

  // The photo, a little crooked on white card, with two strips of tape.
  const frame = PHOTO + PHOTO_PADDING * 2
  const frameCenterY = 990
  context.save()
  context.translate(center, frameCenterY)
  context.rotate(TILT)
  context.shadowColor = 'rgba(27, 17, 12, 0.28)'
  context.shadowBlur = 40
  context.shadowOffsetY = 18
  context.fillStyle = WHITE
  context.fillRect(-frame / 2, -frame / 2, frame, frame)
  context.shadowColor = 'transparent'
  const { sx, sy, sw, sh } = coverCrop(shot.width, shot.height, 1)
  context.drawImage(shot, sx, sy, sw, sh, -PHOTO / 2, -PHOTO / 2, PHOTO, PHOTO)
  for (const side of [-1, 1]) {
    context.save()
    context.translate((side * frame) / 2 - side * 40, -frame / 2)
    context.rotate((side * 28 * Math.PI) / 180)
    context.fillStyle = TAPE
    context.fillRect(-90, -24, 180, 48)
    context.restore()
  }
  context.restore()

  context.fillStyle = INK
  context.textAlign = 'center'
  context.textBaseline = 'alphabetic'
  context.font = `96px ${fonts.display}`
  context.fillText(text.headline.toUpperCase(), center, 1560, 920)
  context.font = `700 40px ${fonts.body}`
  context.fillText(text.caption, center, 1625, 920)
  context.globalAlpha = 0.65
  context.font = `34px ${fonts.body}`
  context.fillText(text.domain, center, 1680, 920)
  context.globalAlpha = 1

  return canvas
}

function drawBadge(context: CanvasRenderingContext2D, label: string, x: number, y: number, font: string) {
  const fontSize = 30
  context.save()
  context.font = `700 ${fontSize}px ${font}`
  if ('letterSpacing' in context) context.letterSpacing = `${fontSize * 0.12}px`
  const text = label.toUpperCase()
  const boxWidth = context.measureText(text).width + fontSize * 1.6
  const boxHeight = fontSize * 1.7
  context.translate(x, y)
  context.rotate(TILT)
  context.fillStyle = RED
  context.fillRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight)
  context.fillStyle = WHITE
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text, 0, 2)
  context.restore()
}
