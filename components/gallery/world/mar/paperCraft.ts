import { seeded } from './textures'

// Paper and tape for the signs drawn on canvas, as they look in a real
// collage. The coloured sheet is torn by hand: its edge wanders at every
// scale, shows the paper's white core in a fibrous band where the top layer
// tore short, and the sheet lies on the poster a little crooked, casting a
// soft shadow. The tape is crepe masking tape: crinkled across its width,
// a little see-through, its long edges cut straight at the factory and its
// ends torn off in uneven teeth.

export type Point = [number, number]

/** Mixes two #rrggbb colours: t = 0 is `a`, 1 is `b`. */
export function mixHex(a: string, b: string, t: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  const out = [0, 1, 2].map((i) => Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * t))
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/**
 * A torn line from `a` toward `b` (b itself is left out, so sides chain):
 * midpoint displacement, each half wandering 0.7 as far as the whole, so the
 * tear is rough at every scale, like paper fibres giving way.
 */
export function tearLine(a: Point, b: Point, amplitude: number, random: () => number, minStep = 2): Point[] {
  const out: Point[] = []
  const split = (p: Point, q: Point, amp: number) => {
    const length = Math.hypot(q[0] - p[0], q[1] - p[1])
    if (length < minStep) {
      out.push(p)
      return
    }
    const nx = -(q[1] - p[1]) / length
    const ny = (q[0] - p[0]) / length
    const shift = (random() - 0.5) * 2 * amp
    const mid: Point = [(p[0] + q[0]) / 2 + nx * shift, (p[1] + q[1]) / 2 + ny * shift]
    split(p, mid, amp * 0.7)
    split(mid, q, amp * 0.7)
  }
  split(a, b, amplitude)
  return out
}

/** The outline of a hand-torn rectangle, clockwise from its top-left corner. */
export function tornOutline(x: number, y: number, w: number, h: number, amplitude: number, random: () => number): Point[] {
  const corner = (px: number, py: number): Point => [px + (random() - 0.5) * amplitude, py + (random() - 0.5) * amplitude]
  const corners = [corner(x, y), corner(x + w, y), corner(x + w, y + h), corner(x, y + h)]
  return corners.flatMap((p, i) => tearLine(p, corners[(i + 1) % 4], amplitude, random))
}

/**
 * The outline of a piece of tape centred on the origin, lying along x:
 * straight long edges (a hair of waviness from the crepe) and, at each end,
 * a slanted tear in teeth of uneven width and depth.
 */
export function tapeOutline(length: number, width: number, unit: number, random: () => number): Point[] {
  const points: Point[] = []
  const top = -width / 2
  const bottom = width / 2
  const half = length / 2
  const edge = (from: number, to: number, y: number) => {
    const steps = Math.max(2, Math.round(Math.abs(to - from) / (6 * unit)))
    for (let i = 0; i < steps; i++) points.push([from + ((to - from) * i) / steps, y + (random() - 0.5) * 0.6 * unit])
  }
  // The tear at one end: walks the width from y0 to y1, teeth pointing out (dir).
  const end = (x: number, y0: number, y1: number, dir: 1 | -1) => {
    const slant = (random() - 0.5) * width * 0.5
    const bow = (random() - 0.5) * width * 0.16
    const at = (y: number) => {
      const t = (y - top) / width
      return x + dir * (slant * (t - 0.5) + bow * Math.sin(Math.PI * t))
    }
    const step = Math.sign(y1 - y0)
    let y = y0
    while ((y1 - y) * step > 0) {
      const tooth = Math.min(Math.abs(y1 - y), (1.6 + random() * 3.6) * unit)
      const depth = (0.8 + random() * 2.6) * unit
      points.push([at(y) - dir * depth * 0.3 * random(), y])
      points.push([at(y + (step * tooth) / 2) + dir * depth, y + (step * tooth) / 2])
      y += step * tooth
    }
  }
  edge(-half, half, top)
  end(half, top, bottom, 1)
  edge(half, -half, bottom)
  end(-half, bottom, top, -1)
  return points
}

function trace(context: CanvasRenderingContext2D, points: Point[]) {
  context.beginPath()
  points.forEach(([px, py], index) => (index === 0 ? context.moveTo(px, py) : context.lineTo(px, py)))
  context.closePath()
}

const TILE = 256
let tile: HTMLCanvasElement | null = null

/**
 * A seamless square of paper texture: mid grey (neutral under 'overlay' and
 * 'soft-light') with short bent fibres, light and dark, and grain in every
 * pixel. Made once per page and shared by every sheet and tape.
 */
function paperTile(): HTMLCanvasElement {
  if (tile) return tile
  const canvas = document.createElement('canvas')
  canvas.width = TILE
  canvas.height = TILE
  const context = canvas.getContext('2d')!
  const random = seeded(97)
  context.fillStyle = 'rgb(128, 128, 128)'
  context.fillRect(0, 0, TILE, TILE)
  for (let i = 0; i < 460; i++) {
    const x = random() * TILE
    const y = random() * TILE
    const length = 4 + random() * 18
    const angle = random() * Math.PI
    const bend = (random() - 0.5) * length * 0.7
    context.strokeStyle = random() < 0.5 ? `rgba(255, 255, 255, ${0.12 + random() * 0.2})` : `rgba(0, 0, 0, ${0.08 + random() * 0.16})`
    context.lineWidth = 0.5 + random() * 0.9
    const dx = Math.cos(angle) * length
    const dy = Math.sin(angle) * length
    // Drawn again one tile over on each side, so a fibre crossing the edge comes back on the other.
    for (const ox of [-TILE, 0, TILE]) {
      for (const oy of [-TILE, 0, TILE]) {
        const x0 = x + ox
        const y0 = y + oy
        if (x0 > TILE + length || x0 < -length || y0 > TILE + length || y0 < -length) continue
        context.beginPath()
        context.moveTo(x0, y0)
        context.quadraticCurveTo(x0 + dx / 2 - Math.sin(angle) * bend, y0 + dy / 2 + Math.cos(angle) * bend, x0 + dx, y0 + dy)
        context.stroke()
      }
    }
  }
  const image = context.getImageData(0, 0, TILE, TILE)
  for (let i = 0; i < image.data.length; i += 4) {
    const n = (random() - 0.5) * 36
    image.data[i] += n
    image.data[i + 1] += n
    image.data[i + 2] += n
  }
  context.putImageData(image, 0, 0)
  tile = canvas
  return canvas
}

/** Lays the paper texture over whatever is clipped, from a seeded corner of the tile so no two pieces match. */
function grain(context: CanvasRenderingContext2D, mode: GlobalCompositeOperation, alpha: number, random: () => number, scale = 1) {
  const pattern = context.createPattern(paperTile(), 'repeat')
  if (!pattern) return
  context.save()
  context.setTransform(scale, 0, 0, scale, -random() * TILE * scale, -random() * TILE * scale)
  context.globalCompositeOperation = mode
  context.globalAlpha = alpha
  context.fillStyle = pattern
  context.fillRect(0, 0, context.canvas.width / scale + TILE, context.canvas.height / scale + TILE)
  context.restore()
}

/** Soft clouds, lighter and darker, as in paper that took the dye or the light unevenly. */
function mottle(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, strength: number, random: () => number) {
  const count = Math.max(10, Math.min(70, Math.round((w * h) / 8000)))
  for (let i = 0; i < count; i++) {
    const cx = x + random() * w
    const cy = y + random() * h
    const r = (0.06 + random() * 0.18) * Math.max(w, h)
    const tone = random() < 0.5 ? '255, 255, 255' : '0, 0, 0'
    const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, r)
    gradient.addColorStop(0, `rgba(${tone}, ${strength * (0.4 + random() * 0.6)})`)
    gradient.addColorStop(1, `rgba(${tone}, 0)`)
    context.fillStyle = gradient
    context.fillRect(cx - r, cy - r, r * 2, r * 2)
  }
}

/** A fold pressed flat again: a lens of light on one side and shade on the other, with a sharp line between, fading at both ends. */
function crease(context: CanvasRenderingContext2D, a: Point, b: Point, spread: number, strength: number) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1])
  const nx = -(b[1] - a[1]) / length
  const ny = (b[0] - a[0]) / length
  const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const band = context.createLinearGradient(mid[0] - nx * spread, mid[1] - ny * spread, mid[0] + nx * spread, mid[1] + ny * spread)
  band.addColorStop(0, 'rgba(255, 255, 255, 0)')
  band.addColorStop(0.47, `rgba(255, 255, 255, ${0.09 * strength})`)
  band.addColorStop(0.5, `rgba(0, 0, 0, ${0.13 * strength})`)
  band.addColorStop(1, 'rgba(0, 0, 0, 0)')
  context.fillStyle = band
  context.beginPath()
  context.moveTo(a[0], a[1])
  context.quadraticCurveTo(mid[0] + nx * spread * 2, mid[1] + ny * spread * 2, b[0], b[1])
  context.quadraticCurveTo(mid[0] - nx * spread * 2, mid[1] - ny * spread * 2, a[0], a[1])
  context.fill()
  const line = context.createLinearGradient(a[0], a[1], b[0], b[1])
  line.addColorStop(0, 'rgba(0, 0, 0, 0)')
  line.addColorStop(0.5, `rgba(0, 0, 0, ${0.2 * strength})`)
  line.addColorStop(1, 'rgba(0, 0, 0, 0)')
  context.strokeStyle = line
  context.lineWidth = 1
  context.beginPath()
  context.moveTo(a[0], a[1])
  context.lineTo(b[0], b[1])
  context.stroke()
}

/** The plain poster stock under everything: barely-there clouds and fibres. */
export function paperGround(context: CanvasRenderingContext2D, color: string, seed: number) {
  const { width, height } = context.canvas
  const random = seeded(seed)
  context.fillStyle = color
  context.fillRect(0, 0, width, height)
  mottle(context, 0, 0, width, height, 0.025, random)
  grain(context, 'overlay', 0.22, random)
}

export type Sheet = {
  x: number
  y: number
  w: number
  h: number
  color: string
  seed: number
  /** Pixels per «point» of detail: tear wander, rim, shadow. About 1 on a 500 px sign. */
  unit: number
  /** Turn about its centre, radians: laid by hand, it is never quite square. */
  tilt?: number
}

/**
 * A sheet of coloured paper torn by hand and laid on the poster. `print`
 * draws what is printed on it (in canvas coordinates; the tilt is applied),
 * and the paper's grain then goes over the print too.
 */
export function tornSheet(context: CanvasRenderingContext2D, sheet: Sheet, print?: () => void) {
  const { x, y, w, h, color, unit } = sheet
  const random = seeded(sheet.seed)
  const face = tornOutline(x, y, w, h, Math.max(3, Math.min(w, h) * 0.016), random)
  // Where the top layer tore short, the white core shows: a band of varying
  // width outside the face, nothing in places, with its own fine roughness.
  const phases = [random(), random(), random()].map((p) => p * Math.PI * 2)
  const rimMax = 5.5 * unit
  let run = 0
  const rim = face.map(([px, py], i): Point => {
    const before = face[(i - 4 + face.length) % face.length]
    const after = face[(i + 4) % face.length]
    const dx = after[0] - before[0]
    const dy = after[1] - before[1]
    const length = Math.hypot(dx, dy) || 1
    if (i > 0) run += Math.hypot(px - face[i - 1][0], py - face[i - 1][1])
    const s = run / unit
    const wave = 0.45 + 0.35 * Math.sin(s / 41 + phases[0]) + 0.25 * Math.sin(s / 15 + phases[1]) + 0.15 * Math.sin(s / 6 + phases[2])
    const out = rimMax * Math.max(0, wave - 0.2) + random() * 0.9 * unit
    return [px + (dy / length) * out, py - (dx / length) * out]
  })
  const core = mixHex('#fbfaf6', color, 0.1)

  context.save()
  context.translate(x + w / 2, y + h / 2)
  context.rotate(sheet.tilt ?? 0)
  context.translate(-(x + w / 2), -(y + h / 2))

  // The shadow on the poster, then the white core.
  context.save()
  context.shadowColor = 'rgba(27, 17, 12, 0.32)'
  context.shadowBlur = 7 * unit
  context.shadowOffsetX = 2 * unit
  context.shadowOffsetY = 3.5 * unit
  trace(context, rim)
  context.fillStyle = core
  context.fill()
  context.restore()
  context.save()
  trace(context, rim)
  context.clip()
  grain(context, 'overlay', 0.45, random)
  context.restore()
  // Loose fibres standing out of the tear.
  context.lineCap = 'round'
  for (let i = 0; i < rim.length; i += 2 + Math.floor(random() * 4)) {
    const [px, py] = rim[i]
    const [qx, qy] = rim[(i + 3) % rim.length]
    const along = Math.atan2(qy - py, qx - px)
    const angle = along - Math.PI / 2 + (random() - 0.5) * 1.6
    const reach = (random() < 0.08 ? 4 + random() * 4 : 1 + random() * 2.6) * unit
    context.strokeStyle = `rgba(250, 249, 244, ${0.45 + random() * 0.4})`
    context.lineWidth = 0.5 + random() * 0.5
    context.beginPath()
    context.moveTo(px, py)
    context.lineTo(px + Math.cos(angle) * reach, py + Math.sin(angle) * reach)
    context.stroke()
  }

  // The coloured face.
  context.save()
  trace(context, face)
  context.fillStyle = color
  context.fill()
  context.clip()
  const light = context.createLinearGradient(x, y, x + w, y + h)
  light.addColorStop(0, 'rgba(255, 255, 255, 0.08)')
  light.addColorStop(0.5, 'rgba(255, 255, 255, 0)')
  light.addColorStop(1, 'rgba(0, 0, 0, 0.12)')
  context.fillStyle = light
  context.fillRect(x - 20, y - 20, w + 40, h + 40)
  mottle(context, x, y, w, h, 0.06, random)
  grain(context, 'overlay', 0.6, random)
  // A soft fold, pressed out again, running in from one side and dying away.
  const fromLeft = random() < 0.5
  const startY = y + h * (0.55 + random() * 0.3)
  crease(
    context,
    [fromLeft ? x - w * 0.02 : x + w * 1.02, startY],
    [fromLeft ? x + w * (0.35 + random() * 0.2) : x + w * (0.45 + random() * 0.2), startY + h * (random() - 0.6) * 0.3],
    22 * unit,
    0.55,
  )
  // The torn rim lifts a little and catches the light.
  trace(context, face)
  context.strokeStyle = 'rgba(255, 255, 255, 0.14)'
  context.lineWidth = 3 * unit
  context.stroke()
  context.restore()

  print?.()

  // Printed on paper: the grain runs through the ink as well.
  context.save()
  trace(context, face)
  context.clip()
  grain(context, 'soft-light', 0.5, random)
  context.restore()
  context.restore()
}

export type Tape = {
  /** Centre, canvas pixels. */
  x: number
  y: number
  length: number
  width: number
  /** Radians. */
  angle: number
  color: string
  seed: number
  unit: number
}

/**
 * A strip of crepe masking tape stuck down over whatever is under it, which
 * shows through faintly, tinted by the tape.
 */
export function tape(context: CanvasRenderingContext2D, strip: Tape) {
  const { length, width, unit, angle } = strip
  const random = seeded(strip.seed)
  const outline = tapeOutline(length, width, unit, random)
  const pad = Math.ceil(8 * unit) + 4
  const w = Math.ceil(length + pad * 2)
  const h = Math.ceil(width + pad * 2)

  // The tape on its own, square to its own canvas.
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const body = canvas.getContext('2d')!
  body.translate(w / 2, h / 2)
  trace(body, outline)
  body.fillStyle = strip.color
  body.fill()
  body.save()
  body.clip()
  // Crepe: fine crinkles across the width, each a little bent and leaning.
  for (let x = -length / 2 - 6 * unit; x < length / 2 + 6 * unit; x += (0.8 + random() * 2.2) * unit) {
    const dark = random() < 0.55
    body.strokeStyle = dark ? `rgba(0, 0, 0, ${0.025 + random() * 0.05})` : `rgba(255, 255, 255, ${0.03 + random() * 0.06})`
    body.lineWidth = (0.4 + random() * 0.8) * unit
    const lean = (random() - 0.5) * width * 0.22
    body.beginPath()
    body.moveTo(x - lean / 2, -width / 2 - 2)
    body.quadraticCurveTo(x + (random() - 0.5) * 3 * unit, 0, x + lean / 2, width / 2 + 2)
    body.stroke()
  }
  grain(body, 'overlay', 0.35, random)
  // Lit from above: a sheen along the upper half, the lower edge in its own shade.
  const sheen = body.createLinearGradient(0, -width / 2, 0, width / 2)
  sheen.addColorStop(0, 'rgba(0, 0, 0, 0.1)')
  sheen.addColorStop(0.1, 'rgba(255, 255, 255, 0.1)')
  sheen.addColorStop(0.32, 'rgba(255, 255, 255, 0.16)')
  sheen.addColorStop(0.6, 'rgba(255, 255, 255, 0)')
  sheen.addColorStop(0.9, 'rgba(0, 0, 0, 0)')
  sheen.addColorStop(1, 'rgba(0, 0, 0, 0.14)')
  body.fillStyle = sheen
  body.fillRect(-w / 2, -h / 2, w, h)
  // A wrinkle near one end, where it was smoothed down unevenly.
  const cx = (random() < 0.5 ? -1 : 1) * length * (0.18 + random() * 0.22)
  const half = width * (0.3 + random() * 0.25)
  const lean = (random() - 0.5) * width * 0.7
  crease(body, [cx - lean / 2, -half], [cx + lean / 2, half], 6 * unit, 0.7)
  body.restore()
  trace(body, outline)
  body.strokeStyle = 'rgba(0, 0, 0, 0.16)'
  body.lineWidth = 0.8
  body.stroke()

  context.save()
  context.translate(strip.x, strip.y)
  context.rotate(angle)
  // The shadow alone: the tape is drawn far off the canvas and only its
  // shadow is thrown back (shadow offsets ignore the rotation).
  const far = 10000
  context.shadowColor = 'rgba(27, 17, 12, 0.3)'
  context.shadowBlur = 2.5 * unit
  context.shadowOffsetX = far * Math.cos(angle) + 0.8 * unit
  context.shadowOffsetY = far * Math.sin(angle) + 1.4 * unit
  context.drawImage(canvas, -w / 2 - far, -h / 2)
  context.shadowColor = 'transparent'
  // Tinted by the tape, then the tape's own body over it, not quite opaque.
  context.globalCompositeOperation = 'multiply'
  context.drawImage(canvas, -w / 2, -h / 2)
  context.globalCompositeOperation = 'source-over'
  context.globalAlpha = 0.45
  context.drawImage(canvas, -w / 2, -h / 2)
  context.restore()
}
