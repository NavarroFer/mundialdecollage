import { describe, expect, it } from 'vitest'
import { readAllRows } from '@/lib/read-all-rows'

const table = (count: number) => Array.from({ length: count }, (_, i) => ({ id: i }))
const sliceOf = (rows: { id: number }[]) => async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null })

describe('readAllRows', () => {
  it('reads past the per-request cap', async () => {
    const rows = await readAllRows<{ id: number }>(sliceOf(table(2501)), 1000)
    expect(rows).toHaveLength(2501)
    expect(rows.at(-1)).toEqual({ id: 2500 })
  })

  it('stops without an extra request when the last slice is full', async () => {
    let calls = 0
    const rows = await readAllRows<{ id: number }>(async (from, to) => { calls++; return sliceOf(table(2000))(from, to) }, 1000)
    expect(rows).toHaveLength(2000)
    expect(calls).toBe(3) // the empty third slice is how it knows it is done
  })

  it('returns an empty table as an empty list', async () => {
    expect(await readAllRows(sliceOf([]), 1000)).toEqual([])
  })

  it('throws instead of returning a partial list', async () => {
    await expect(readAllRows(async () => ({ data: null, error: { message: 'boom' } }))).rejects.toThrow('boom')
  })
})
