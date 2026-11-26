import { IMAGE_WIDTHS } from '@/lib/image-widths.mjs'

// How wide each mosaic photo is asked from /api/img: the tile's width on a
// wide screen at 2× density, rounded up to a size it already makes (and the
// CDN already caches), so 1700 photos cost no new resizes beyond the first.
export function tileWidth(columns: number): number {
  const wanted = Math.ceil((1100 / columns) * 2)
  return IMAGE_WIDTHS.find((width) => width >= wanted) ?? IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1]
}
