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
