import { afterEach, describe, expect, it, vi } from 'vitest'
import { parsePreferences, useGalleryPreferences } from './store'

afterEach(() => { vi.unstubAllGlobals(); useGalleryPreferences.setState(parsePreferences(null)) })

describe('gallery preferences', () => {
  it('recovers from missing, corrupt and invalid browser data', () => {
    for (const raw of [null, '{', 'null', '[]', '{"theme":"missing","sensitivity":999,"visited":false}']) {
      expect(parsePreferences(raw)).toMatchObject({ theme: 'collage', sensitivity: 1, visited: [], muted: false })
    }
  })
  it('walks by clicks unless the visitor chose the keyboard or joystick', () => {
    expect(parsePreferences(null).controlMode).toBe('point')
    expect(parsePreferences('{"controlMode":"classic"}').controlMode).toBe('classic')
    expect(parsePreferences('{"controlMode":"teleport"}').controlMode).toBe('point')
  })
  it('bounds history and rejects non-string artwork IDs', () => {
    const visited = Array.from({ length: 510 }, (_, i) => `art-${i}`)
    const state = parsePreferences(JSON.stringify({ visited: [...visited, 42, null, 'art-509'], muted: true, theme: 'garden', sensitivity: 0.5 }))
    expect(state.visited).toHaveLength(500)
    expect(state.visited[0]).toBe('art-10')
    expect(state).toMatchObject({ muted: true, theme: 'garden', sensitivity: 0.5 })
  })
  it('remembers the latest artwork without duplicating visits and restores preferences', () => {
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value) })
    useGalleryPreferences.getState().update({ muted: true, theme: 'garden', controlMode: 'classic' })
    for (const id of ['a', 'b', 'a']) useGalleryPreferences.getState().visit(id)
    useGalleryPreferences.setState(parsePreferences(null))
    useGalleryPreferences.getState().hydrate()
    expect(useGalleryPreferences.getState()).toMatchObject({ muted: true, theme: 'garden', controlMode: 'classic', visited: ['b', 'a'], lastArtwork: 'a' })
  })
  it('keeps the gallery usable when browser storage is blocked', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw Error('blocked') }, setItem: () => { throw Error('blocked') } })
    expect(() => useGalleryPreferences.getState().hydrate()).not.toThrow()
    useGalleryPreferences.getState().visit('a')
    expect(useGalleryPreferences.getState().lastArtwork).toBe('a')
  })
})
