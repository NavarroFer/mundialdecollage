import { describe, expect, it } from 'vitest'
import { barWidth, fileSlug, foldRows, highlightIndexes, niceTicks, valueLabelIndexes, xLabelIndexes } from './chart-math'

describe('niceTicks', () => {
  it('covers the max with round, whole steps', () => {
    expect(niceTicks(37)).toEqual([0, 10, 20, 30, 40])
    expect(niceTicks(3)).toEqual([0, 1, 2, 3])
    expect(niceTicks(1234)).toEqual([0, 500, 1000, 1500])
  })

  it('still draws an axis with no data', () => {
    expect(niceTicks(0)).toEqual([0, 1])
  })
})

describe('xLabelIndexes', () => {
  it('prints every label when they fit', () => {
    expect(xLabelIndexes(5, 600)).toEqual([0, 1, 2, 3, 4])
  })

  it('keeps the first and last and spaces the rest', () => {
    const indexes = xLabelIndexes(90, 600)
    expect(indexes[0]).toBe(0)
    expect(indexes.at(-1)).toBe(89)
    expect(indexes.length).toBeLessThanOrEqual(Math.floor(600 / 76))
  })

  it('never crowds the last label', () => {
    const indexes = xLabelIndexes(31, 400)
    const [beforeLast, last] = indexes.slice(-2)
    expect(last - beforeLast).toBeGreaterThanOrEqual(Math.ceil(30 / 4) / 2)
  })
})

describe('valueLabelIndexes', () => {
  it('labels every point when there is room', () => {
    expect(valueLabelIndexes(7, 600)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('thins labels out from the last point back', () => {
    const indexes = valueLabelIndexes(90, 600)
    expect(indexes.at(-1)).toBe(89)
    expect(indexes.length).toBeLessThan(90)
  })
})

describe('highlightIndexes', () => {
  it('names the peak and the last point', () => {
    expect(highlightIndexes([1, 9, 3])).toEqual([1, 2])
  })

  it('names only the last point when it is the peak or all are zero', () => {
    expect(highlightIndexes([1, 2, 5])).toEqual([2])
    expect(highlightIndexes([0, 0, 0])).toEqual([2])
  })
})

describe('foldRows', () => {
  const rows = [
    { label: 'Argentina', value: 50, recent: 5 },
    { label: 'Chile', value: 10, recent: 1 },
    { label: 'Perú', value: 6, recent: 0 },
    { label: 'Uruguay', value: 4, recent: 2 },
  ]

  it('sums the tail into «Otros» and keeps the total', () => {
    const { rows: folded, folded: count } = foldRows(rows, 2)
    expect(folded.map((row) => row.label)).toEqual(['Argentina', 'Chile', 'Otros (2)'])
    expect(folded.at(-1)).toMatchObject({ value: 10, recent: 2 })
    expect(count).toBe(2)
    expect(folded.reduce((sum, row) => sum + row.value, 0)).toBe(70)
  })

  it('keeps a list whole when only one row would fold, or with no limit', () => {
    expect(foldRows(rows, 3).rows).toBe(rows)
    expect(foldRows(rows, null).rows).toBe(rows)
  })
})

describe('barWidth', () => {
  it('scales to the longest bar and keeps a sliver for small values', () => {
    expect(barWidth(50, 100)).toBe(50)
    expect(barWidth(1, 1000)).toBe(2)
    expect(barWidth(0, 100)).toBe(0)
    expect(barWidth(5, 0)).toBe(0)
  })
})

describe('fileSlug', () => {
  it('turns a title into a file name', () => {
    expect(fileSlug('Histórico de participaciones')).toBe('historico-de-participaciones')
    expect(fileSlug('«Avisame» de finalistas y revista')).toBe('avisame-de-finalistas-y-revista')
    expect(fileSlug('¿?')).toBe('grafico')
  })
})
