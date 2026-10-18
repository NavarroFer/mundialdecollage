import { IMAGE_WIDTHS } from './image-widths.mjs'

// Images in public/ that next/image serves as pre-resized WebP instead of the
// original (774 KB for the splash's logo, shown at 40px in the header for the
// mark; the shop's 2000px banner on a phone). scripts/brand-images.mjs writes
// them to public/brand/ at every width next/image may ask for below the
// original's. The originals stay: emails and the certificate need the PNGs as
// they are, and the script reads them. Every local file a next/image shows
// belongs here: the loader can't resize anything else.
// Plain .mjs so the script can import it too.
export const BRAND_IMAGES = {
  '/logo.png': { name: 'logo', width: 1415 },
  '/logo-mark.png': { name: 'logo-mark', width: 512 },
  '/wordmark.png': { name: 'wordmark', width: 949 },
  '/tienda-productos.webp': { name: 'tienda-productos', width: 2000 },
}

export const BRAND_QUALITY = 80

/** @param {number} width the original's width */
export function brandWidths(width) {
  return [...IMAGE_WIDTHS.filter((w) => w < width), width]
}

/** @param {string} name @param {number} width */
export function brandFile(name, width) {
  return `/brand/${name}-${width}.webp`
}
