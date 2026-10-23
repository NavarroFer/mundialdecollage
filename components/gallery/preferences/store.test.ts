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
  it('remembers the music volume, never silence or out of range', () => {
    expect(parsePreferences(null).volume).toBe(60)
    expect(parsePreferences('{"volume":25}').volume).toBe(25)
    for (const volume of [0, 101, 12.5, '40', null]) expect(parsePreferences(JSON.stringify({ volume })).volume).toBe(60)
  })
  it('remembers the avatar chosen, unless it left the cast', () => {
    expect(parsePreferences(null).avatar).toBeNull()
    expect(parsePreferences('{"avatar":"Female_Adult_11"}').avatar).toBe('Female_Adult_11')
    expect(parsePreferences('{"avatar":"Female_Child_01"}').avatar).toBeNull()
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
    useGalleryPreferences.getState().update({ muted: true, volume: 30, theme: 'garden', controlMode: 'classic' })
    for (const id of ['a', 'b', 'a']) useGalleryPreferences.getState().visit(id)
    useGalleryPreferences.setState(parsePreferences(null))
    useGalleryPreferences.getState().hydrate()
    expect(useGalleryPreferences.getState()).toMatchObject({ muted: true, volume: 30, theme: 'garden', controlMode: 'classic', visited: ['b', 'a'], lastArtwork: 'a' })
  })
  it('keeps the gallery usable when browser storage is blocked', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw Error('blocked') }, setItem: () => { throw Error('blocked') } })
    expect(() => useGalleryPreferences.getState().hydrate()).not.toThrow()
    useGalleryPreferences.getState().visit('a')
    expect(useGalleryPreferences.getState().lastArtwork).toBe('a')
  })
})
