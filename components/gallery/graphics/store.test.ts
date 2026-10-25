import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGraphics } from './store'
beforeEach(() => {
  useGraphics.setState({ selection: 'auto', adaptive: true, current: 'medium', detected: 'medium', mobile: false, fps: null, hydrated: false })
})
afterEach(() => vi.unstubAllGlobals())
describe('graphics preferences', () => {
  it('keeps a manual choice through hardware detection and saves only preferences', () => {
    const setItem = vi.fn()
    vi.stubGlobal('localStorage', { getItem: () => null, setItem })
    useGraphics.getState().hydrate()
    useGraphics.getState().configure('ultra', false)
    useGraphics.getState().detect({ mobile: true, cores: 2 })
    expect(useGraphics.getState().current).toBe('ultra')
    expect(useGraphics.getState().detected).toBe('low')
    expect(setItem).toHaveBeenCalledWith('mdc-gallery-graphics-v1', '{"selection":"ultra","adaptive":false}')
    useGraphics.getState().configure('auto', true)
    expect(useGraphics.getState().current).toBe('low')
  })
  it('hydrates once without overwriting a running adaptive decision', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{"selection":"high","adaptive":true}' })
    useGraphics.getState().hydrate()
    expect(useGraphics.getState().current).toBe('high')
    useGraphics.setState({ current: 'low' })
    useGraphics.getState().hydrate()
    expect(useGraphics.getState().current).toBe('low')
  })
  it('continues in private mode when storage throws', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw Error('blocked') }, setItem: () => { throw Error('blocked') } })
    expect(() => useGraphics.getState().hydrate()).not.toThrow()
    expect(() => useGraphics.getState().configure('medium', false)).not.toThrow()
    expect(useGraphics.getState().selection).toBe('medium')
  })
})
