import { describe, expect, it } from 'vitest'
import { VISITORS } from '../visitorRoutes'
import { CAST, REMOTE_CAST, SCRIPTED_CAST } from './cast'

describe('cast', () => {
  it('gives every scripted route someone from the cast', () => {
    const names = new Set(CAST.map(({ name }) => name))
    for (const { id } of VISITORS) expect(names.has(SCRIPTED_CAST[id]), id).toBe(true)
  })

  it('casts each scripted visitor once', () => {
    const scripted = Object.values(SCRIPTED_CAST)
    expect(new Set(scripted).size).toBe(scripted.length)
  })

  it('keeps real visitors from looking like a scripted one', () => {
    const scripted = new Set(Object.values(SCRIPTED_CAST))
    expect(REMOTE_CAST.length).toBeGreaterThan(0)
    for (const { name } of REMOTE_CAST) expect(scripted.has(name)).toBe(false)
  })

  it('has adults only, like the site’s audience', () => {
    for (const { name } of CAST) expect(name).not.toMatch(/child/i)
  })
})
