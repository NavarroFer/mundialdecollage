import { MAX_IMAGE_DIMENSION } from '@/lib/onboarding-image'

// Files at or under this size and MAX_IMAGE_DIMENSION are uploaded untouched.
const RECOMPRESS_ABOVE_BYTES = 2 * 1024 * 1024

// Colours the canvas must give back after a JPEG round trip. Browsers that
// guard against canvas fingerprinting (Brave's strict shields, Firefox with
// resistFingerprinting, some privacy extensions) hand back noise or a flat
// colour instead of the picture: a collage then reached Storage as a brown
// moiré and stayed that way. When the canary doesn't survive, the original
// file goes up untouched.
const CANARY_SIZE = 32
const CANARY_TOLERANCE = 48
const CANARY_COLORS = [
  [220, 30, 30],
  [30, 180, 60],
  [30, 60, 220],
  [240, 220, 40],
] as const

/** True when every sampled pixel is within tolerance of the colour that was painted there. */
export function canaryMatches(samples: ArrayLike<number>[]): boolean {
  return CANARY_COLORS.every((color, index) => {
    const pixel = samples[index]
    return !!pixel && color.every((channel, i) => Math.abs(channel - pixel[i]) <= CANARY_TOLERANCE)
  })
}

let canaryResult: Promise<boolean> | undefined

/** Whether this browser's canvas gives back what was drawn on it. Checked once per page. */
function canvasIsFaithful(): Promise<boolean> {
  canaryResult ??= (async () => {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = CANARY_SIZE
      const context = canvas.getContext('2d')
      if (!context) return false
      const half = CANARY_SIZE / 2
      CANARY_COLORS.forEach(([r, g, b], index) => {
        context.fillStyle = `rgb(${r} ${g} ${b})`
        context.fillRect((index % 2) * half, Math.floor(index / 2) * half, half, half)
      })
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
      if (!blob) return false
      const bitmap = await createImageBitmap(blob)
      const back = document.createElement('canvas')
      back.width = back.height = CANARY_SIZE
      const backContext = back.getContext('2d')
      if (!backContext) return false
      backContext.drawImage(bitmap, 0, 0)
      bitmap.close()
      const quarter = CANARY_SIZE / 4
      const samples = CANARY_COLORS.map((_, index) =>
        backContext.getImageData((index % 2) * half + quarter, Math.floor(index / 2) * half + quarter, 1, 1).data)
      return canaryMatches(samples)
    } catch {
      return false
    }
  })()
  return canaryResult
}

// Browser only. Shrinks a picked photo to MAX_IMAGE_DIMENSION (or
// maxDimension) on its longest side, re-encoded as JPEG, before it goes to
// Storage — a phone photo of a collage is often 5-15MB, and only its first
// ~2000px are ever shown. GIFs (may be animated) and anything the browser
// can't decode go up as they are, as does a result that didn't come out
// smaller.
export async function downscaleImage(file: File, maxDimension = MAX_IMAGE_DIMENSION): Promise<File> {
  if (file.type === 'image/gif' || typeof createImageBitmap !== 'function') return file
  try {
    if (!(await canvasIsFaithful())) return file
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size <= RECOMPRESS_ABOVE_BYTES) {
      bitmap.close()
      return file
    }
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext('2d')
    if (!context) return file
    // JPEG has no alpha: a transparent PNG would otherwise turn black.
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
    if (!blob || blob.size >= file.size) return file
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified })
  } catch {
    return file
  }
}
