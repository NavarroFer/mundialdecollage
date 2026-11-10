import { describe, expect, it } from 'vitest'
import { FLAG, MOSAIC_LIMIT, cellAt, loadOrder, mosaicCell, mosaicEntries, mosaicGrid, mosaicUrls } from './mosaic'

describe('mosaicGrid', () => {
  it('always has a cell for every obra, in square cells that fit the cloth', () => {
    for (const count of [1, 7, 37, 120, 333, 600]) {
      const grid = mosaicGrid(count)
      expect(grid.columns * grid.rows, `${count}`).toBeGreaterThanOrEqual(count)
      expect(grid.cell * grid.columns).toBeCloseTo(1024)
    }
  })

  it('never runs past the bottom of the canvas it is drawn on: every row is visible', () => {
    const height = 1024 / (FLAG.width / FLAG.height)
    for (const count of [1, 5, 10, 37, 100, 250, 600]) {
      const grid = mosaicGrid(count)
      expect(grid.rows * grid.cell, `${count}`).toBeLessThanOrEqual(height + 0.001)
      // And the last obra's cell is one of them.
      expect(Math.floor((count - 1) / grid.columns), `${count}`).toBeLessThan(grid.rows)
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

describe('mosaicEntries', () => {
  it('keeps what came with each image, so a cell leads back to its obra', () => {
    const kept = mosaicEntries([{ imageUrl: 'a', slug: 'uno' }, { imageUrl: 'a', slug: 'repetida' }, { imageUrl: null, slug: 'sin' }, { imageUrl: 'b', slug: 'dos' }])
    expect(kept.map((entry) => entry.slug)).toEqual(['uno', 'dos'])
  })
})

describe('cellAt', () => {
  const canvas = { width: 1024, height: 2018 }

  it('reads the cell under a point, v counted up from the cloth\'s foot', () => {
    const grid = mosaicGrid(120, FLAG.width / FLAG.height, canvas.width)
    // Top left corner of the cloth is the first cell; the foot's left corner is the first of the last row drawn.
    expect(cellAt(0.001, 0.999, grid, canvas, 120)).toBe(0)
    expect(cellAt(0.999, 0.999, grid, canvas, 120)).toBe(grid.columns - 1)
    const second = mosaicCell(grid.columns + 1, grid)
    expect(cellAt((second.x + grid.cell / 2) / canvas.width, 1 - (second.y + grid.cell / 2) / canvas.height, grid, canvas, 120)).toBe(grid.columns + 1)
  })

  it('is null where there is no obra: past the last cell, off the cloth, or not a number', () => {
    const grid = mosaicGrid(10, FLAG.width / FLAG.height, canvas.width)
    expect(cellAt(0.5, 0.001, grid, canvas, 10)).toBeNull()
    expect(cellAt(-0.1, 0.5, grid, canvas, 10)).toBeNull()
    expect(cellAt(1, 0.5, grid, canvas, 10)).toBeNull()
    expect(cellAt(NaN, 0.5, grid, canvas, 10)).toBeNull()
  })
})
