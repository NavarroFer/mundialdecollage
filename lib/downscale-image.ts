import { MAX_IMAGE_DIMENSION } from '@/lib/onboarding-image'

// Files at or under this size and MAX_IMAGE_DIMENSION are uploaded untouched.
const RECOMPRESS_ABOVE_BYTES = 2 * 1024 * 1024

// Browser only. Shrinks a picked photo to MAX_IMAGE_DIMENSION on its longest
// side, re-encoded as JPEG, before it goes to Storage — a phone photo of a
// collage is often 5-15MB, and only its first ~2000px are ever shown. GIFs
// (may be animated) and anything the browser can't decode go up as they are,
// as does a result that didn't come out smaller.
export async function downscaleImage(file: File): Promise<File> {
  if (file.type === 'image/gif' || typeof createImageBitmap !== 'function') return file
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height))
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
