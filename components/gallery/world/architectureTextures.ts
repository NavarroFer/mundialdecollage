import * as THREE from 'three'

// Drawn once on a canvas instead of shipping image files.

function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

/** What the glass shows: a pale overcast day, or Windows' blue sky with clouds. */
export function skyTexture(kind: 'daylight' | 'clouds') {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')!
  const gradient = context.createLinearGradient(0, 0, size, size)
  if (kind === 'clouds') {
    gradient.addColorStop(0, '#2f6fc4')
    gradient.addColorStop(1, '#79aee8')
  } else {
    gradient.addColorStop(0, '#fbf8f0')
    gradient.addColorStop(1, '#dde8ee')
  }
  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)
  const random = seeded(kind === 'clouds' ? 7 : 3)
  for (let i = 0; i < 18; i++) {
    const x = random() * size
    const y = random() * size
    const r = 30 + random() * 70
    const puff = context.createRadialGradient(x, y, 0, x, y, r)
    const alpha = kind === 'clouds' ? 0.85 : 0.5
    puff.addColorStop(0, `rgba(255,255,255,${alpha})`)
    puff.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = puff
    context.fillRect(x - r, y - r, r * 2, r * 2)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** Wood floorboards running along the gallery, in staggered lengths and tones. */
export function plankTexture(base: string, metersPerTile: number) {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')!
  const random = seeded(11)
  const pxPerMeter = size / metersPerTile
  const rows = Math.round(metersPerTile / 0.19)
  const rowHeight = size / rows
  const color = new THREE.Color(base)
  const hsl = { h: 0, s: 0, l: 0 }
  color.getHSL(hsl)

  for (let row = 0; row < rows; row++) {
    const y = row * rowHeight
    // Start each row at a random seam so the joints never line up.
    let x = -random() * 2 * pxPerMeter
    while (x < size) {
      const length = (1.1 + random() * 1.4) * pxPerMeter
      const board = new THREE.Color().setHSL(hsl.h + (random() - 0.5) * 0.02, hsl.s * (0.85 + random() * 0.3), hsl.l * (0.86 + random() * 0.28))
      context.fillStyle = `#${board.getHexString()}`
      // Boards crossing the tile's edge wrap around to the start.
      for (const offset of [-size, 0, size]) context.fillRect(x - offset, y, length, rowHeight)
      context.strokeStyle = 'rgba(40,24,12,0.18)'
      context.lineWidth = 1
      for (let grain = 0; grain < 5; grain++) {
        const gy = y + 4 + random() * (rowHeight - 8)
        context.beginPath()
        context.moveTo(x, gy)
        context.bezierCurveTo(x + length * 0.3, gy + (random() - 0.5) * 6, x + length * 0.7, gy + (random() - 0.5) * 6, x + length, gy)
        context.stroke()
      }
      context.fillStyle = 'rgba(30,18,8,0.55)'
      context.fillRect(x, y, 2, rowHeight)
      x += length
    }
    context.fillStyle = 'rgba(30,18,8,0.45)'
    context.fillRect(0, y, size, 2)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 8
  return texture
}
