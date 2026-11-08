import * as THREE from 'three'

// Drawn once on a canvas. No image files: the joints and the cobbles are a
// module we can retile when a measured panel or paver size replaces the guess.

function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

function canvasTexture(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 4
  return texture
}

/** One concrete panel. The mesh UVs scale this to MAR.panel. */
export function concreteTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')!
  const random = seeded(11)
  // Each tile is one panel. The shade shifts a little so a wall is not one flat colour.
  const tone = 188 + Math.floor(random() * 18)
  context.fillStyle = `rgb(${tone}, ${tone - 4}, ${tone - 10})`
  context.fillRect(0, 0, size, size)
  for (let i = 0; i < 70; i++) {
    context.fillStyle = `rgba(70, 66, 60, ${0.03 + random() * 0.07})`
    context.fillRect(random() * size, random() * size, 8 + random() * 40, 6 + random() * 24)
  }
  context.fillStyle = '#6f6b64'
  context.fillRect(0, 0, size, 10)
  context.fillRect(0, 0, 10, size)
  context.fillStyle = 'rgba(255, 252, 246, 0.28)'
  context.fillRect(10, 10, size - 20, 3)
  return canvasTexture(canvas)
}

/** Plaza cobbles, one module. */
export function cobbleTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')!
  context.fillStyle = '#8d8880'
  context.fillRect(0, 0, size, size)
  const random = seeded(5)
  const cols = 5
  const rows = 6
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const shade = 138 + Math.floor(random() * 48)
      context.fillStyle = `rgb(${shade}, ${shade - 3}, ${shade - 9})`
      const ox = ((y % 2) * size) / cols / 2
      const jitter = (random() - 0.5) * 6
      context.fillRect(ox + (x * size) / cols + 3 + jitter, (y * size) / rows + 3, size / cols - 7, size / rows - 7)
    }
  }
  return canvasTexture(canvas)
}

/** Dark steps along an escalator. */
export function escalatorTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 256
  const context = canvas.getContext('2d')!
  context.fillStyle = '#4a4e52'
  context.fillRect(0, 0, 64, 256)
  context.fillStyle = '#2c3034'
  for (let y = 0; y < 256; y += 32) context.fillRect(0, y, 64, 6)
  context.fillStyle = '#6a7076'
  for (let y = 6; y < 256; y += 32) context.fillRect(0, y, 64, 2)
  return canvasTexture(canvas)
}
