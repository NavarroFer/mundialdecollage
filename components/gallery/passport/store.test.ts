import { afterEach, describe, expect, it, vi } from 'vitest'
import { parsePassport, usePassportStore } from './store'

afterEach(() => {
  vi.unstubAllGlobals()
  usePassportStore.setState({ ...parsePassport(null), storageKey: null, open: false })
})

function stubStorage() {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) })
  return storage
}

describe('visit passport', () => {
  it('recovers from missing, corrupt and invalid browser data', () => {
    for (const raw of [null, '{', 'null', '[]', '{"days":"2026-10-11","photos":-3}', '{"days":[1,"ayer"],"photos":1.5}']) {
      expect(parsePassport(raw)).toEqual({ days: [], photos: 0 })
    }
  })

  it('counts each exhibition day once, in order', () => {
    expect(parsePassport('{"days":["2026-10-11","2026-10-09","2026-10-11"],"photos":2}')).toEqual({ days: ['2026-10-09', '2026-10-11'], photos: 2 })
  })

  it('keeps one passport per account', () => {
    const storage = stubStorage()
    const passport = usePassportStore.getState()
    passport.hydrate('ana')
    passport.recordDay('2026-10-11')
    passport.recordDay('2026-10-11')
    passport.recordPhoto()
    expect(JSON.parse(storage.get('mdc-gallery-passport-v1:ana')!)).toEqual({ days: ['2026-10-11'], photos: 1 })

    passport.hydrate('beto')
    expect(usePassportStore.getState()).toMatchObject({ days: [], photos: 0 })
    passport.hydrate('ana')
    expect(usePassportStore.getState()).toMatchObject({ days: ['2026-10-11'], photos: 1 })
  })

  it('keeps counting when browser storage is blocked', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw Error('blocked') }, setItem: () => { throw Error('blocked') } })
    usePassportStore.getState().hydrate('ana')
    usePassportStore.getState().recordPhoto()
    expect(usePassportStore.getState().photos).toBe(1)
  })
})
