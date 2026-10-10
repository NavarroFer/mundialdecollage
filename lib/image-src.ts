import { IMAGE_WIDTHS } from '@/lib/image-widths.mjs'

// Artwork photos in Supabase Storage go through app/api/img, which serves
// them resized and cached by the CDN instead of the full upload (often a
// multi-MB phone photo). Everything else — files in public/, previews of a
// picked file (blob:/data:) — is returned as is. For plain <img> and 3D
// textures; next/image does this through lib/image-loader.ts.
export function imageSrc(src: string, width: number): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl || !src.startsWith(`${supabaseUrl}/storage/v1/object/public/`)) return src
  const allowed = IMAGE_WIDTHS.find((w) => w >= width) ?? IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1]
  return `/api/img?url=${encodeURIComponent(src)}&w=${allowed}`
}

// Width descriptors let the browser pick a derivative for the actual card
// size and pixel density instead of downloading 828px for every thumbnail.
export function imageSrcSet(src: string): string | undefined {
  if (imageSrc(src, 384) === src) return undefined
  return IMAGE_WIDTHS.map((width) => `${imageSrc(src, width)} ${width}w`).join(', ')
}
