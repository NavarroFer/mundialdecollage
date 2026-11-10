import { describe, expect, it } from 'vitest'
import { FLAG, MOSAIC_LIMIT, loadOrder, mosaicCell, mosaicGrid, mosaicUrls } from './mosaic'

describe('mosaicGrid', () => {
  it('always has a cell for every obra, in square cells that fit the cloth', () => {
    for (const count of [1, 7, 37, 120, 333, 600]) {
      const grid = mosaicGrid(count)
      expect(grid.columns * grid.rows, `${count}`).toBeGreaterThanOrEqual(count)
      expect(grid.cell * grid.columns).toBeCloseTo(1024)
    }
  })

  it('keeps cells roughly square on the flag: the grid is about as tall as the cloth', () => {
    const grid = mosaicGrid(300)
    const clothRatio = FLAG.width / FLAG.height
    expect(grid.columns / grid.rows).toBeGreaterThan(clothRatio * 0.7)
    expect(grid.columns / grid.rows).toBeLessThan(clothRatio * 1.3)
  })

  it('lays cells left to right, then down', () => {
    const grid = mosaicGrid(40)
    expect(mosaicCell(0, grid)).toEqual({ x: 0, y: 0 })
    expect(mosaicCell(1, grid).x).toBeCloseTo(grid.cell)
    expect(mosaicCell(grid.columns, grid)).toEqual({ x: 0, y: grid.cell })
  })
})

describe('mosaicUrls', () => {
  it('drops empty and repeated images', () => {
    expect(mosaicUrls([{ imageUrl: 'a' }, { imageUrl: null }, { imageUrl: 'a' }, { imageUrl: '' }, { imageUrl: 'b' }, {}])).toEqual(['a', 'b'])
  })

  it('samples evenly past the limit instead of cutting the tail off', () => {
    const entries = Array.from({ length: MOSAIC_LIMIT * 2 }, (_, index) => ({ imageUrl: `u${index}` }))
    const urls = mosaicUrls(entries)
    expect(urls).toHaveLength(MOSAIC_LIMIT)
    expect(urls[0]).toBe('u0')
    expect(urls[urls.length - 1]).toBe(`u${MOSAIC_LIMIT * 2 - 2}`)
  })
})

describe('loadOrder', () => {
  it('visits every cell exactly once, the same way every time, and not top to bottom', () => {
    const order = loadOrder(200)
    expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: 200 }, (_, index) => index))
    expect(loadOrder(200)).toEqual(order)
    // The first twenty loaded are not the first twenty cells.
    expect(order.slice(0, 20).some((index) => index >= 100)).toBe(true)
    expect(loadOrder(0)).toEqual([])
  })
})
