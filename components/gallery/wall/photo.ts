// Browser only. Every photo pasted on the collage goes up as a JPEG of at
// most 1200px — it's shown half a meter wide, and the bucket only takes
// `.jpg` paths (lib/collage-wall.ts). Null when the browser can't read the
// file (e.g. HEIC outside Safari), so the visitor can pick another.
const MAX_SIDE = 1200

export async function wallPhoto(file: File): Promise<Blob | null> {
  if (typeof createImageBitmap !== 'function') return null
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext('2d')
    if (!context) return null
    // JPEG has no alpha: a transparent PNG would otherwise turn black.
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  } catch {
    return null
  }
}
