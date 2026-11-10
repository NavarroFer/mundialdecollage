// The hall's hanging flag shows every published obra as one mosaic. This file
// is the pure part: which obras go in, and how the grid is cut. Drawing and
// fetching live in HallFlag.tsx.

/** The flag's cloth, metres. */
export const FLAG = { width: 3.4, height: 6.7, /** Lowest edge above the floor. */ bottom: 0.7 } as const

/** Most obras the flag will draw. Each is one small image request; the CDN keeps them, but a phone should not fetch thousands. */
export const MOSAIC_LIMIT = 600

export type MosaicGrid = { columns: number; rows: number; cell: number }

/**
 * The smallest grid of square cells that holds `count` obras and still fits
 * the canvas the cloth is drawn on (its width is `pixelWidth`, its height that
 * over `ratio`, the cloth's width ÷ height). Rows are however many fit, so the
 * grid never runs past the bottom of the canvas; cells after the last obra stay blank.
 */
export function mosaicGrid(count: number, ratio: number = FLAG.width / FLAG.height, pixelWidth = 1024): MosaicGrid {
  const safe = Math.max(1, Math.floor(count))
  let columns = 1
  while (columns * Math.max(1, Math.floor(columns / ratio)) < safe) columns++
  return { columns, rows: Math.max(1, Math.floor(columns / ratio)), cell: pixelWidth / columns }
}

/** Where cell `index` goes, left to right then top to bottom, in canvas pixels. */
export function mosaicCell(index: number, grid: MosaicGrid) {
  return { x: (index % grid.columns) * grid.cell, y: Math.floor(index / grid.columns) * grid.cell }
}

export type MosaicSource = { imageUrl?: string | null }

/**
 * Obras to draw: de-duplicated by image, empty ones dropped, and spread evenly
 * if there are more than the limit, so a long catalogue is sampled rather
 * than cut off at the oldest. Each keeps what came with it (slug, title…), so
 * a cell can be traced back to its obra.
 */
export function mosaicEntries<T extends MosaicSource>(entries: T[], limit = MOSAIC_LIMIT): Array<T & { imageUrl: string }> {
  const seen = new Set<string>()
  const kept: Array<T & { imageUrl: string }> = []
  for (const entry of entries) {
    const url = entry.imageUrl
    if (!url || seen.has(url)) continue
    seen.add(url)
    kept.push(entry as T & { imageUrl: string })
  }
  if (kept.length <= limit) return kept
  return Array.from({ length: limit }, (_, index) => kept[Math.floor((index * kept.length) / limit)])
}

/** Image addresses of the obras to draw (see mosaicEntries). */
export function mosaicUrls(entries: MosaicSource[], limit = MOSAIC_LIMIT): string[] {
  return mosaicEntries(entries, limit).map((entry) => entry.imageUrl)
}

/**
 * The cell under a point of the cloth, from the texture coordinates the
 * raycaster reports (u across from the left, v up from the bottom) and the
 * canvas the grid is drawn on. Null off the grid, or in a cell with no obra.
 */
export function cellAt(u: number, v: number, grid: MosaicGrid, canvas: { width: number; height: number }, count: number): number | null {
  if (!Number.isFinite(u) || !Number.isFinite(v) || u < 0 || u >= 1 || v < 0 || v > 1) return null
  const column = Math.floor((u * canvas.width) / grid.cell)
  const row = Math.floor(((1 - v) * canvas.height) / grid.cell)
  if (column < 0 || column >= grid.columns || row < 0) return null
  const index = row * grid.columns + column
  return index < count ? index : null
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
