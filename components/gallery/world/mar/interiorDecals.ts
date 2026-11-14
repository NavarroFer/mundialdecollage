import { canvasOf, canvasTexture, seeded } from './textures'

// Ground-floor interior surfaces, drawn on canvases like the facade's.

const SANS = 'Helvetica Neue, Arial, Helvetica, sans-serif'

/** Glossy black fascia with white lettering, as hung over the shop. */
export function fasciaTexture(title: string, lines: string[]) {
  const { canvas, context } = canvasOf(1024, 296)
  context.fillStyle = '#0d0e10'
  context.fillRect(0, 0, 1024, 296)
  const sheen = context.createLinearGradient(0, 0, 0, 296)
  sheen.addColorStop(0, 'rgba(255,255,255,0.08)')
  sheen.addColorStop(0.5, 'rgba(255,255,255,0)')
  context.fillStyle = sheen
  context.fillRect(0, 0, 1024, 296)
  context.fillStyle = '#f4f4f1'
  context.textBaseline = 'middle'
  context.font = `700 128px ${SANS}`
  context.fillText(title, 48, 150)
  context.font = `500 26px ${SANS}`
  lines.forEach((line, index) => context.fillText(line, 52, 232 + index * 30))
  return canvasTexture(canvas, false)
}

/** The Laboratorio's lettering, on a transparent ground so it prints over the black wall. */
export function labTexture() {
  const { canvas, context } = canvasOf(2048, 360)
  context.clearRect(0, 0, 2048, 360)
  context.fillStyle = '#f5f5f2'
  context.textBaseline = 'middle'
  // Fit each line to the canvas instead of trusting a font size: the lettering must not run off the wall.
  const fit = (text: string, weight: number, start: number, limit: number) => {
    let size = start
    context.font = `${weight} ${size}px ${SANS}`
    while (context.measureText(text).width > limit && size > 12) {
      size -= 4
      context.font = `${weight} ${size}px ${SANS}`
    }
  }
  const title = 'ESPACIO LABORATORIO'
  fit(title, 800, 190, 1960)
  context.fillText(title, 40, 130)
  const sub = 'TALLERES  |  ENSAYOS EDUCATIVOS  |  PUNTO DE ENCUENTRO  |  EXPRESIÓN COLECTIVA'
  fit(sub, 600, 46, 1960)
  context.fillText(sub, 48, 290)
  return canvasTexture(canvas, false)
}

/** Expanded-metal ceiling panels in white frames. One repeat is 2 × 2 panels. */
export function meshCeilingTexture() {
  const size = 512
  const { canvas, context } = canvasOf(size, size)
  context.clearRect(0, 0, size, size)
  // Diamond mesh.
  context.strokeStyle = 'rgba(135, 138, 135, 0.95)'
  context.lineWidth = 1
  for (let i = -size; i < size * 2; i += 9) {
    context.beginPath()
    context.moveTo(i, 0)
    context.lineTo(i + size, size)
    context.moveTo(i + size, 0)
    context.lineTo(i, size)
    context.stroke()
  }
  context.strokeStyle = 'rgba(230, 232, 230, 0.35)'
  for (let i = -size; i < size * 2; i += 9) {
    context.beginPath()
    context.moveTo(i + 1, 0)
    context.lineTo(i + size + 1, size)
    context.stroke()
  }
  // White frames at every panel edge.
  context.fillStyle = '#e9eaea'
  const half = size / 2
  context.fillRect(0, 0, size, 6)
  context.fillRect(0, half - 3, size, 6)
  context.fillRect(0, 0, 6, size)
  context.fillRect(half - 3, 0, 6, size)
  return canvasTexture(canvas)
}

/** Board-formed concrete, boards laid level: the shop's backdrop wall. One repeat is 2.4 × 2.4 m. */
export function boardTexture() {
  const size = 512
  const { canvas, context } = canvasOf(size, size)
  const random = seeded(61)
  const boards = 12
  const h = size / boards
  for (let row = 0; row < boards; row++) {
    const tone = 168 + random() * 18
    context.fillStyle = `rgb(${tone + 4}, ${tone}, ${tone - 6})`
    context.fillRect(0, row * h, size, h)
    for (let g = 0; g < 9; g++) {
      context.fillStyle = `rgba(80, 74, 66, ${0.06 + random() * 0.1})`
      context.fillRect(random() * size, row * h + random() * h, 30 + random() * 160, 1)
    }
    context.fillStyle = 'rgba(70, 66, 60, 0.4)'
    context.fillRect(0, row * h, size, 1.4)
    const joint = random() * size
    context.fillRect(joint, row * h, 1.4, h)
  }
  return canvasTexture(canvas)
}

/** Pale slats of the louvre band over the way into the café. */
export function slatTexture() {
  const { canvas, context } = canvasOf(256, 128)
  context.fillStyle = '#b8b8b4'
  context.fillRect(0, 0, 256, 128)
  const slats = 9
  const h = 128 / slats
  for (let i = 0; i < slats; i++) {
    context.fillStyle = '#e7e7e3'
    context.fillRect(0, i * h, 256, h * 0.6)
    context.fillStyle = 'rgba(60,60,58,0.55)'
    context.fillRect(0, i * h + h * 0.6, 256, h * 0.4)
  }
  return canvasTexture(canvas)
}

/** Floor drain: a long dark grate. */
export function grateTexture() {
  const { canvas, context } = canvasOf(256, 32)
  context.fillStyle = '#1d1c1a'
  context.fillRect(0, 0, 256, 32)
  context.fillStyle = '#6e6454'
  for (let x = 4; x < 256; x += 8) context.fillRect(x, 4, 3, 24)
  context.fillStyle = '#7a7568'
  context.fillRect(0, 0, 256, 3)
  context.fillRect(0, 29, 256, 3)
  return canvasTexture(canvas)
}

/** The flag's cloth: plain white. The mosaic is drawn over it, so cells without an obra yet stay white. */
export function clothBase(width: number, height: number) {
  const { canvas, context } = canvasOf(width, height)
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  return { canvas, context }
}

/** The grey fascia of a display case in the lounge, lettered in white. */
export function vitrineTexture() {
  const { canvas, context } = canvasOf(1024, 256)
  context.fillStyle = '#8b8689'
  context.fillRect(0, 0, 1024, 256)
  context.fillStyle = '#f6f4f2'
  context.textBaseline = 'middle'
  context.font = `600 62px ${SANS}`
  context.fillText('Lobo Marino de Alfajores, Marta Minujin', 36, 98)
  context.font = `500 50px ${SANS}`
  context.fillText('Material de archivo', 36, 178)
  return canvasTexture(canvas, false)
}
