// Browser only. Every photo pasted on the collage goes up at most 1200px —
// it's shown well under a meter wide. A cutout (a PNG or WebP with a
// transparent background, the collage way) keeps its transparency as WebP
// (PNG where the browser can't write WebP); anything else becomes a JPEG.
// Null when the browser can't read the file (e.g. HEIC outside Safari), so
// the visitor can pick another.
const MAX_SIDE = 1200

export type WallPhoto = { blob: Blob; extension: 'jpg' | 'webp' | 'png' }

function hasTransparency(context: CanvasRenderingContext2D, width: number, height: number) {
  const { data } = context.getImageData(0, 0, width, height)
  for (let index = 3; index < data.length; index += 4) if (data[index] < 250) return true
  return false
}

const encode = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))

export async function wallPhoto(file: File): Promise<WallPhoto | null> {
  if (typeof createImageBitmap !== 'function') return null
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return null
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    if (file.type !== 'image/jpeg' && hasTransparency(context, canvas.width, canvas.height)) {
      const webp = await encode(canvas, 'image/webp', 0.85)
      // Browsers that can't write WebP hand back a PNG instead.
      if (webp?.type === 'image/webp') return { blob: webp, extension: 'webp' }
      const png = await encode(canvas, 'image/png')
      return png ? { blob: png, extension: 'png' } : null
    }

    // JPEG has no alpha: paint any see-through edge white rather than black.
    context.globalCompositeOperation = 'destination-over'
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    const jpeg = await encode(canvas, 'image/jpeg', 0.85)
    return jpeg ? { blob: jpeg, extension: 'jpg' } : null
  } catch {
    return null
  }
}
