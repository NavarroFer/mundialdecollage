import * as THREE from 'three'
import { canvasOf, canvasTexture, seeded } from './textures'

// Printed and painted things on the facade, drawn on canvases. Each one is a
// stand-in for what the photographs show, not a traced logo or a scan.

const SANS = 'Helvetica Neue, Arial, Helvetica, sans-serif'

function finish(canvas: HTMLCanvasElement) {
  return canvasTexture(canvas, false)
}

/** "Buenos Aires Provincia", relief lettering on the concrete: light grey with a shadow edge. */
export function provinciaLogoTexture() {
  const { canvas, context } = canvasOf(1024, 256)
  const paint = (dx: number, dy: number, color: string) => {
    context.fillStyle = color
    // The province's silhouette: a rounded block with a notch cut from its top right.
    context.beginPath()
    context.moveTo(40 + dx, 92 + dy)
    context.bezierCurveTo(40 + dx, 40 + dy, 110 + dx, 28 + dy, 150 + dx, 40 + dy)
    context.bezierCurveTo(190 + dx, 52 + dy, 196 + dx, 100 + dx, 168 + dy, 126 + dy)
    context.bezierCurveTo(206 + dx, 150 + dy, 190 + dx, 214 + dy, 120 + dx, 214 + dy)
    context.bezierCurveTo(70 + dx, 214 + dy, 56 + dx, 182 + dy, 66 + dx, 150 + dy)
    context.bezierCurveTo(34 + dx, 146 + dy, 40 + dx, 112 + dy, 40 + dx, 92 + dy)
    context.fill()
    context.font = `500 82px ${SANS}`
    context.textBaseline = 'alphabetic'
    context.fillText('Buenos Aires', 262 + dx, 128 + dy)
    context.fillText('Provincia', 262 + dx, 214 + dy)
  }
  paint(3, 3, 'rgba(60, 56, 50, 0.5)')
  paint(-1.5, -1.5, 'rgba(250, 247, 240, 0.7)')
  paint(0, 0, '#b3b0a9')
  return finish(canvas)
}

/**
 * The vinyl wrapped round the ground floor of the right-hand volume: a quote
 * of Luis Felipe Noé over white panels, the ink drawing of an eye, and a black
 * end panel with a QR code and two logos.
 */
export function noeBannerTexture() {
  const width = 2048
  const height = 512
  const { canvas, context } = canvasOf(width, height)
  const random = seeded(77)
  context.fillStyle = '#f4f3ef'
  context.fillRect(0, 0, width, height)
  // Black end panel.
  const blackFrom = width * 0.86
  context.fillStyle = '#1a1c1f'
  context.fillRect(blackFrom, 0, width - blackFrom, height)

  context.fillStyle = '#17181a'
  context.font = `400 34px Georgia, 'Times New Roman', serif`
  context.fillText('El ojo que mira diseña las imágenes, y así va imaginando el mundo.', 40, 190)
  context.fillText('El ojo que simplemente ve es ciego, y así no va imaginando el mundo.', 40, 246)
  context.font = `italic 28px Georgia, serif`
  context.fillText('Luis Felipe Noé', 700, 316)
  context.font = `400 15px ${SANS}`
  context.fillStyle = '#555'
  context.fillText('Más información', 40, 392)

  // The eye: dense black strokes that swell into a pupil.
  context.strokeStyle = '#111'
  context.lineCap = 'round'
  const cx = width * 0.74
  const cy = height * 0.5
  for (let i = 0; i < 90; i++) {
    context.lineWidth = 1 + random() * 5
    context.beginPath()
    const y = cy - 60 + random() * 150
    context.moveTo(cx - 190 + random() * 40, y + (random() - 0.5) * 20)
    context.bezierCurveTo(cx - 90, y - 70 + random() * 40, cx + 40, y - 50 + random() * 40, cx + 140 + random() * 80, y + (random() - 0.5) * 50)
    context.stroke()
  }
  context.fillStyle = '#0c0c0d'
  context.beginPath()
  context.ellipse(cx, cy + 4, 62, 54, -0.3, 0, Math.PI * 2)
  context.fill()

  // QR code, as a pattern of squares.
  const qr = 118
  const qx = blackFrom + 40
  const qy = 56
  context.fillStyle = '#fff'
  context.fillRect(qx - 8, qy - 8, qr + 16, qr + 16)
  context.fillStyle = '#111'
  const cell = qr / 21
  for (let y = 0; y < 21; y++) {
    for (let x = 0; x < 21; x++) {
      const corner = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13)
      const dark = corner ? (x % 6 === 0 || y % 6 === 0 || x === 6 || y === 6 || ((x % 7) > 1 && (x % 7) < 5 && (y % 7) > 1 && (y % 7) < 5)) : random() < 0.5
      if (dark) context.fillRect(qx + x * cell, qy + y * cell, cell, cell)
    }
  }
  context.fillStyle = '#e8e6e1'
  context.font = `700 24px ${SANS}`
  context.fillText('NOÉ', blackFrom + 36, 380)
  context.font = `400 12px ${SANS}`
  context.fillText('FUNDACIÓN LUIS FELIPE NOÉ', blackFrom + 36, 402)
  context.font = `700 28px ${SANS}`
  context.fillText('MAR', blackFrom + 36, 450)

  // Panel seams.
  context.fillStyle = 'rgba(40, 40, 40, 0.5)'
  for (let i = 1; i < 7; i++) context.fillRect((blackFrom / 6.2) * i, 0, 2, height)
  return finish(canvas)
}

/** Blue and white abstract with a column of bold type: the exhibition poster left of the doors. */
export function biformesPosterTexture() {
  const { canvas, context } = canvasOf(340, 640)
  const random = seeded(3)
  context.fillStyle = '#efefec'
  context.fillRect(0, 0, 340, 640)
  context.fillStyle = '#d8d8d6'
  context.beginPath()
  context.ellipse(40, 110, 130, 190, -0.4, 0, Math.PI * 2)
  context.fill()
  // Painting on the right half.
  context.fillStyle = '#2f62b8'
  context.fillRect(170, 0, 170, 600)
  const colors = ['#0f1f55', '#f3f1ec', '#1a1a1c', '#e1b54a', '#4f8fd6']
  for (let i = 0; i < 70; i++) {
    context.fillStyle = colors[Math.floor(random() * colors.length)]
    context.save()
    context.translate(170 + random() * 170, random() * 600)
    context.rotate(random() * Math.PI)
    context.fillRect(0, 0, 10 + random() * 54, 8 + random() * 36)
    context.restore()
  }
  context.fillStyle = '#16171a'
  context.font = `800 25px ${SANS}`
  ;['biformes', 'bicoloreadas', 'bitremendas', 'bilejanas'].forEach((line, index) => context.fillText(line, 16, 250 + index * 30))
  context.font = `400 25px ${SANS}`
  context.fillText('lejanas', 16, 390)
  context.fillText('lejanas', 16, 420)
  context.fillStyle = '#222'
  context.fillRect(0, 600, 340, 40)
  return finish(canvas)
}

/** Dark panel with the bank's mark: a green and teal pair of shapes over its name. */
export function bancoPanelTexture() {
  const { canvas, context } = canvasOf(220, 640)
  context.fillStyle = '#1b1e21'
  context.fillRect(0, 0, 220, 640)
  context.fillStyle = '#2ea66a'
  context.beginPath()
  context.moveTo(54, 250)
  context.bezierCurveTo(54, 190, 92, 168, 130, 172)
  context.bezierCurveTo(176, 178, 176, 240, 138, 250)
  context.bezierCurveTo(110, 256, 92, 236, 54, 250)
  context.fill()
  context.fillStyle = '#27a7b8'
  context.beginPath()
  context.arc(80, 290, 24, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#f2f2ee'
  context.font = `700 30px ${SANS}`
  context.fillText('Banco', 54, 360)
  context.fillText('Provincia', 54, 394)
  return finish(canvas)
}

/** White poster with a bold title and a grey ribbon sculpture. */
export function maquinasPosterTexture() {
  const { canvas, context } = canvasOf(340, 560)
  context.fillStyle = '#f6f6f3'
  context.fillRect(0, 0, 340, 560)
  context.fillStyle = '#1b1c1e'
  context.font = `700 30px ${SANS}`
  context.fillText('Las máquinas', 26, 82)
  context.fillText('deseantes', 26, 118)
  context.fillStyle = '#9a9a98'
  for (let i = 0; i < 9; i++) context.fillRect(26, 170 + i * 15, 130 + ((i * 37) % 90), 5)
  context.strokeStyle = '#a7a7a5'
  context.lineWidth = 9
  context.lineCap = 'round'
  context.beginPath()
  context.moveTo(70, 330)
  context.bezierCurveTo(130, 280, 170, 420, 230, 360)
  context.bezierCurveTo(280, 330, 300, 380, 250, 430)
  context.stroke()
  context.strokeStyle = '#c9c9c7'
  context.lineWidth = 5
  context.beginPath()
  context.moveTo(90, 300)
  context.bezierCurveTo(150, 340, 190, 300, 270, 350)
  context.stroke()
  return finish(canvas)
}

/** Round gold-on-navy emblem on the café glass. */
export function cafeEmblemTexture() {
  const { canvas, context } = canvasOf(256, 256)
  context.clearRect(0, 0, 256, 256)
  context.fillStyle = 'rgba(14, 20, 38, 0.92)'
  context.beginPath()
  context.ellipse(128, 128, 112, 124, 0, 0, Math.PI * 2)
  context.fill()
  context.strokeStyle = '#c9a54e'
  context.lineWidth = 8
  context.beginPath()
  context.ellipse(128, 128, 100, 112, 0, 0, Math.PI * 2)
  context.stroke()
  context.fillStyle = '#d8b65a'
  context.font = `700 44px Georgia, serif`
  context.textAlign = 'center'
  context.fillText('WEISS', 128, 140)
  return finish(canvas)
}

/** Green exit sign above the doors. */
export function exitSignTexture() {
  const { canvas, context } = canvasOf(256, 96)
  context.fillStyle = 'rgba(40, 150, 90, 0.9)'
  context.fillRect(0, 0, 256, 96)
  context.fillStyle = '#e8fff0'
  context.font = `700 58px ${SANS}`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText('SALIDA', 128, 52)
  return finish(canvas)
}

/** The orange tactile pad set in the paving: a grid of raised dots. */
export function tactileTexture() {
  const { canvas, context } = canvasOf(256, 192)
  context.fillStyle = '#d4592f'
  context.fillRect(0, 0, 256, 192)
  context.fillStyle = '#e57a4c'
  for (let y = 12; y < 192; y += 24) for (let x = 12; x < 256; x += 24) {
    context.beginPath()
    context.arc(x, y, 6, 0, Math.PI * 2)
    context.fill()
  }
  return finish(canvas)
}

/** The plaque among the rocks at the sea lion's foot: brushed grey, engraved, on two posts. */
export function loboPlaqueTexture() {
  const { canvas, context } = canvasOf(1024, 440)
  context.fillStyle = '#c9cbcd'
  context.fillRect(0, 0, 1024, 440)
  const sheen = context.createLinearGradient(0, 0, 1024, 440)
  sheen.addColorStop(0, 'rgba(255,255,255,0.35)')
  sheen.addColorStop(0.5, 'rgba(255,255,255,0)')
  sheen.addColorStop(1, 'rgba(60,64,68,0.18)')
  context.fillStyle = sheen
  context.fillRect(0, 0, 1024, 440)
  context.strokeStyle = 'rgba(90, 94, 98, 0.5)'
  context.lineWidth = 6
  context.strokeRect(3, 3, 1018, 434)
  context.fillStyle = '#2f3336'
  context.textBaseline = 'alphabetic'
  context.font = `italic 600 50px Georgia, serif`
  context.fillText('Lobo Marino De Alfajores', 46, 86)
  context.font = `italic 400 36px Georgia, serif`
  context.fillText('Idea y creación de Marta Minujín.', 46, 150)
  context.font = `italic 400 36px Georgia, serif`
  context.fillText('Donación de HAVANNA S.A. al', 46, 250)
  context.fillText('Instituto Cultural de la Provincia de Buenos Aires', 46, 300)
  context.font = `italic 400 28px Georgia, serif`
  context.textAlign = 'right'
  context.fillText('Mar del Plata - 2014', 980, 400)
  return finish(canvas)
}

export function disposeAll(textures: THREE.Texture[]) {
  textures.forEach((texture) => texture.dispose())
}
