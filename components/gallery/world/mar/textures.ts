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
  context.fillStyle = '#c9c4ba'
  context.fillRect(0, 0, size, size)
  const random = seeded(11)
  for (let i = 0; i < 90; i++) {
    context.fillStyle = `rgba(80, 76, 70, ${0.025 + random() * 0.06})`
    context.fillRect(random() * size, random() * size, 6 + random() * 36, 6 + random() * 22)
  }
  context.strokeStyle = '#8f8b83'
  context.lineWidth = 7
  context.strokeRect(3, 3, size - 6, size - 6)
  context.strokeStyle = 'rgba(255, 252, 246, 0.35)'
  context.lineWidth = 2
  context.strokeRect(8, 8, size - 16, size - 16)
  return canvasTexture(canvas)
}

/** Plaza cobbles, one module. */
export function cobbleTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')!
  context.fillStyle = '#b3aea6'
  context.fillRect(0, 0, size, size)
  const random = seeded(5)
  const cols = 4
  const rows = 5
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const shade = 150 + Math.floor(random() * 40)
      context.fillStyle = `rgb(${shade}, ${shade - 4}, ${shade - 10})`
      const ox = (y % 2) * (size / cols / 2)
      context.fillRect(ox + (x * size) / cols + 2, (y * size) / rows + 2, size / cols - 4, size / rows - 5)
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
