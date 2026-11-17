import { afterEach, describe, expect, it } from 'vitest'
import { mosaicGrid } from '../world/mar/mosaic'
import { flagAim, useFlagStore, type FlagEntry } from '../flag/store'
import { useWallStore } from '../wall/store'
import { interact } from './interact'
import { useInteractionStore } from './store'

const entries: FlagEntry[] = Array.from({ length: 40 }, (_, index) => ({ imageUrl: `u${index}`, slug: `obra-${index}` }))

afterEach(() => {
  flagAim.current = null
  useFlagStore.setState({ layout: null, entry: null })
  useInteractionStore.setState({ targetId: null, openId: null })
  useWallStore.setState({ placing: null })
})

describe('E on the hall flag', () => {
  it('opens the obra it points at, and closes its card the next time', () => {
    useFlagStore.getState().setLayout({ entries, grid: mosaicGrid(entries.length), canvas: { width: 1024, height: 2018 } })
    flagAim.current = () => ({ u: 0.001, v: 0.999 })
    interact()
    expect(useFlagStore.getState().entry?.slug).toBe('obra-0')
    interact()
    expect(useFlagStore.getState().entry).toBeNull()
  })

  it('leaves the cloth alone pointing elsewhere, or with an obra of the walls in front', () => {
    useFlagStore.getState().setLayout({ entries, grid: mosaicGrid(entries.length), canvas: { width: 1024, height: 2018 } })
    flagAim.current = () => null
    interact()
    expect(useFlagStore.getState().entry).toBeNull()
    flagAim.current = () => ({ u: 0.001, v: 0.999 })
    useInteractionStore.setState({ targetId: 'mural' })
    interact()
    expect(useInteractionStore.getState().openId).toBe('mural')
    expect(useFlagStore.getState().entry).toBeNull()
  })
})
