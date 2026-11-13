import * as THREE from 'three'

// Drawn once on a canvas. No image files: the joints, the setts and the weave
// are modules we can retile when a measured size replaces the guess.

export function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

export function canvasOf(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return { canvas, context: canvas.getContext('2d')! }
}

export function canvasTexture(canvas: HTMLCanvasElement, repeat = true, anisotropy = 8) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
  }
  texture.anisotropy = anisotropy
  return texture
}

/** Concrete panels across one repeat of the facade texture, and down. */
export const CONCRETE_TILE = { columns: 4, rows: 4 } as const

/**
 * Board-formed concrete, as in the photographs: panels laid in rows that do
 * not line up from one row to the next, each a slightly different grey, with
 * hairline joints, pin holes and long vertical water streaks. One repeat
 * covers CONCRETE_TILE panels each way (MAR.panel × columns/rows metres).
 */
export function concreteTexture() {
  const width = 1024
  const height = 512
  const { canvas, context } = canvasOf(width, height)
  const random = seeded(11)
  const panelW = width / CONCRETE_TILE.columns
  const panelH = height / CONCRETE_TILE.rows

  context.fillStyle = 'rgb(184, 180, 173)'
  context.fillRect(0, 0, width, height)

  const offsets: number[] = []
  for (let row = 0; row < CONCRETE_TILE.rows; row++) {
    const offset = random() * panelW
    offsets.push(offset)
    for (let column = -1; column <= CONCRETE_TILE.columns; column++) {
      const x = column * panelW + offset
      const tone = (random() - 0.5) * 16
      context.fillStyle = `rgb(${184 + tone}, ${180 + tone}, ${173 + tone * 0.9})`
      context.fillRect(x, row * panelH, panelW, panelH)
      // Each sheet is a little darker toward one edge, where the form sagged.
      const shade = context.createLinearGradient(x, 0, x + panelW, 0)
      const dark = random() < 0.5
      shade.addColorStop(dark ? 0 : 1, `rgba(90, 86, 80, ${0.04 + random() * 0.06})`)
      shade.addColorStop(dark ? 1 : 0, 'rgba(90, 86, 80, 0)')
      context.fillStyle = shade
      context.fillRect(x, row * panelH, panelW, panelH)
    }
  }

  // Cloudy mottling.
  for (let i = 0; i < 260; i++) {
    context.fillStyle = random() < 0.5 ? `rgba(92, 88, 82, ${0.015 + random() * 0.035})` : `rgba(240, 236, 228, ${0.02 + random() * 0.04})`
    context.beginPath()
    context.ellipse(random() * width, random() * height, 10 + random() * 60, 6 + random() * 30, random() * Math.PI, 0, Math.PI * 2)
    context.fill()
  }
  // Water streaks running down from the panel joints.
  for (let i = 0; i < 46; i++) {
    const x = random() * width
    const y = random() * height * 0.7
    const length = 40 + random() * 220
    const streak = context.createLinearGradient(0, y, 0, y + length)
    streak.addColorStop(0, `rgba(78, 74, 68, ${0.03 + random() * 0.05})`)
    streak.addColorStop(1, 'rgba(78, 74, 68, 0)')
    context.fillStyle = streak
    context.fillRect(x, y, 2 + random() * 7, length)
  }
  // Pin holes and small voids.
  for (let i = 0; i < 520; i++) {
    context.fillStyle = `rgba(64, 60, 54, ${0.12 + random() * 0.3})`
    const size = 0.6 + random() * 1.7
    context.fillRect(random() * width, random() * height, size, size)
  }

  // Joints last: a dark hairline with a thin light edge under it.
  for (let row = 0; row < CONCRETE_TILE.rows; row++) {
    const offset = offsets[row]
    const y = row * panelH
    context.fillStyle = 'rgba(70, 66, 60, 0.55)'
    context.fillRect(0, y, width, 1.6)
    context.fillStyle = 'rgba(244, 240, 232, 0.3)'
    context.fillRect(0, y + 1.6, width, 1.2)
    for (let column = -1; column <= CONCRETE_TILE.columns; column++) {
      const x = column * panelW + offset
      context.fillStyle = 'rgba(70, 66, 60, 0.4)'
      context.fillRect(x, y, 1.4, panelH)
      context.fillStyle = 'rgba(244, 240, 232, 0.22)'
      context.fillRect(x + 1.4, y, 1, panelH)
    }
  }
  return canvasTexture(canvas)
}

/** Edge of one sett, in metres. The plaza is laid in fans of these. */
export const SETT = 0.1
/** One repeat of the plaza paving: 2 fans wide, 8 staggered rows tall. */
export const COBBLE_TILE = 3

/**
 * Granite setts in overlapping fans (the "adoquín en abanico" the plaza is
 * paved in): each fan is rings of setts around a centre, drawn row by row so
 * the next row bites into the one before.
 */
export function cobbleTexture() {
  const size = 1024
  const { canvas, context } = canvasOf(size, size)
  const random = seeded(5)
  const px = size / COBBLE_TILE
  const radius = 0.75 * px
  const sett = SETT * px

  context.fillStyle = '#4d4a46'
  context.fillRect(0, 0, size, size)

  const drawFan = (cx: number, cy: number) => {
    // A sett's tone is shared with its neighbours a little, like a quarried batch.
    for (let ring = 0; ring * sett < radius; ring++) {
      const rho = ring * sett + sett / 2
      const count = Math.max(1, Math.round((2 * Math.PI * rho) / sett))
      const step = (2 * Math.PI) / count
      const phase = random() * step
      for (let n = 0; n < count; n++) {
        const angle = phase + n * step
        const tone = 124 + random() * 44
        const warm = (random() - 0.5) * 8
        context.fillStyle = `rgb(${tone + warm}, ${tone - 2}, ${tone - warm * 0.8 - 4})`
        context.save()
        context.translate(cx + Math.cos(angle) * rho, cy + Math.sin(angle) * rho)
        context.rotate(angle + Math.PI / 2)
        const w = rho * step * 0.9
        context.fillRect(-w / 2, -sett * 0.46, w, sett * 0.92)
        context.restore()
      }
    }
  }
  // Rows a quarter of a fan apart: each row covers the centres of the one above, so only
  // the curved crescents of every fan show, like fish scales.
  const rowStep = radius / 2
  for (let row = -2; row <= 8 + 2; row++) {
    for (let column = -1; column <= 2; column++) {
      drawFan(column * 2 * radius + radius + (((row % 2) + 2) % 2) * radius, row * rowStep)
    }
  }
  // Grit and moss in the joints.
  for (let i = 0; i < 700; i++) {
    context.fillStyle = `rgba(40, 38, 34, ${0.1 + random() * 0.25})`
    context.fillRect(random() * size, random() * size, 1 + random() * 2, 1 + random() * 2)
  }
  return canvasTexture(canvas)
}

/** 16 × 8 wrappers per repeat: approximately 10 × 20 cm per packet. */
export const WEAVE_TILE = 1.6

/** Dark steps along an escalator. */
export function escalatorTexture() {
  const { canvas, context } = canvasOf(64, 256)
  context.fillStyle = '#4a4e52'
  context.fillRect(0, 0, 64, 256)
  context.fillStyle = '#2c3034'
  for (let y = 0; y < 256; y += 32) context.fillRect(0, y, 64, 6)
  context.fillStyle = '#6a7076'
  for (let y = 6; y < 256; y += 32) context.fillRect(0, y, 64, 2)
  return canvasTexture(canvas)
}

/** Horizontal louvres with flaking dark paint, as on the vent housing beside the stair. */
export function louvreTexture() {
  const { canvas, context } = canvasOf(512, 128)
  const random = seeded(41)
  context.fillStyle = '#b9b2a6'
  context.fillRect(0, 0, 512, 128)
  const slats = 6
  const h = 128 / slats
  for (let i = 0; i < slats; i++) {
    const y = i * h
    context.fillStyle = '#d2cdc3'
    context.fillRect(0, y, 512, h * 0.55)
    context.fillStyle = '#3a342f'
    context.fillRect(0, y + h * 0.55, 512, h * 0.4)
    for (let k = 0; k < 90; k++) {
      context.fillStyle = random() < 0.5 ? '#9b8d78' : '#cfc9bd'
      context.fillRect(random() * 512, y + h * 0.55 + random() * h * 0.4, 2 + random() * 12, 1 + random() * 3)
    }
    context.fillStyle = 'rgba(0,0,0,0.35)'
    context.fillRect(0, y + h * 0.5, 512, 2)
  }
  return canvasTexture(canvas, false)
}
