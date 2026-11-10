// The hall's hanging flag shows every published obra as one mosaic. This file
// is the pure part: which obras go in, and how the grid is cut. Drawing and
// fetching live in HallFlag.tsx.

/** The flag's cloth, metres. */
export const FLAG = { width: 3.4, height: 6.7, /** Lowest edge above the floor. */ bottom: 0.7 } as const

/** Most obras the flag will draw. Each is one small image request; the CDN keeps them, but a phone should not fetch thousands. */
export const MOSAIC_LIMIT = 600

export type MosaicGrid = { columns: number; rows: number; cell: number }

/** The smallest grid of square cells that holds `count` obras on a cloth of this ratio (width ÷ height). */
export function mosaicGrid(count: number, ratio: number = FLAG.width / FLAG.height, pixelWidth = 1024): MosaicGrid {
  const safe = Math.max(1, Math.floor(count))
  let columns = Math.max(1, Math.round(Math.sqrt(safe * ratio)))
  let rows = Math.ceil(safe / columns)
  // The cloth is taller than it is wide, so favour filling its height before widening.
  while ((columns + 1) * Math.floor((columns + 1) / ratio) < safe && columns < safe) columns++
  rows = Math.max(rows, Math.ceil(columns / ratio))
  return { columns, rows: Math.max(rows, Math.ceil(safe / columns)), cell: pixelWidth / columns }
}

/** Where cell `index` goes, left to right then top to bottom, in canvas pixels. */
export function mosaicCell(index: number, grid: MosaicGrid) {
  return { x: (index % grid.columns) * grid.cell, y: Math.floor(index / grid.columns) * grid.cell }
}

export type MosaicSource = { imageUrl?: string | null }

/**
 * Obra images to draw: de-duplicated, empty ones dropped, and spread evenly
 * if there are more than the limit, so a long catalogue is sampled rather
 * than cut off at the oldest.
 */
export function mosaicUrls(entries: MosaicSource[], limit = MOSAIC_LIMIT): string[] {
  const seen = new Set<string>()
  const urls: string[] = []
  for (const entry of entries) {
    const url = entry.imageUrl
    if (!url || seen.has(url)) continue
    seen.add(url)
    urls.push(url)
  }
  if (urls.length <= limit) return urls
  return Array.from({ length: limit }, (_, index) => urls[Math.floor((index * urls.length) / limit)])
}

/**
 * The order to load cells in: every index once, shuffled with a fixed seed.
 * Loading top to bottom filled the cloth from its top, which is out of sight
 * from the floor; a shuffle spreads the first pictures over all of it.
 */
export function loadOrder(count: number, seed = 7): number[] {
  const order = Array.from({ length: Math.max(0, Math.floor(count)) }, (_, index) => index)
  let state = seed
  const next = () => {
    state = (state * 16807) % 2147483647
    return state / 2147483647
  }
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}
