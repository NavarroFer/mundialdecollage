import { beforeEach, describe, expect, it } from 'vitest'
import { mosaicGrid } from '../world/mar/mosaic'
import { useFlagStore, type FlagEntry } from './store'

const canvas = { width: 1024, height: 2018 }

function layout(entries: FlagEntry[]) {
  return { entries, grid: mosaicGrid(entries.length), canvas }
}

describe('useFlagStore', () => {
  beforeEach(() => useFlagStore.setState({ layout: null, entry: null }))

  it('opens the obra under the click', () => {
    const entries = Array.from({ length: 40 }, (_, index) => ({ imageUrl: `u${index}`, slug: `obra-${index}`, title: `t${index}` }))
    useFlagStore.getState().setLayout(layout(entries))
    expect(useFlagStore.getState().pick(0.001, 0.999)).toBe(true)
    expect(useFlagStore.getState().entry?.slug).toBe('obra-0')
    useFlagStore.getState().close()
    expect(useFlagStore.getState().entry).toBeNull()
  })

  it('opens nothing before the cloth is drawn, on a blank cell, or on an obra with no page', () => {
    expect(useFlagStore.getState().pick(0.5, 0.5)).toBe(false)
    useFlagStore.getState().setLayout(layout([{ imageUrl: 'a' }, { imageUrl: 'b', slug: 'b' }]))
    expect(useFlagStore.getState().pick(0.001, 0.999)).toBe(false)
    expect(useFlagStore.getState().pick(0.5, 0.001)).toBe(false)
    expect(useFlagStore.getState().entry).toBeNull()
  })
})
