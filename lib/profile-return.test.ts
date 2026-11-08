import { afterEach, describe, expect, it } from 'vitest'
import {
  armProfileReturn,
  consumeProfileIntent,
  profileReturnPath,
  readProfileReturn,
  withoutReturnParams,
} from './profile-return'

afterEach(() => armProfileReturn(null))

describe('profileReturnPath / readProfileReturn', () => {
  it('round-trips the obra and the action through the artist profile link', () => {
    const path = profileReturnPath('/artistas/ana-perez', { slug: 'ana-perez-sol', intent: 'comment' })
    expect(path).toBe('/artistas/ana-perez?obra=ana-perez-sol&accion=comment')
    expect(readProfileReturn(path.slice(path.indexOf('?')))).toEqual({ slug: 'ana-perez-sol', intent: 'comment' })
  })

  it('ignores unknown actions, the gallery-only stamp, and missing or oversized slugs', () => {
    expect(readProfileReturn('?obra=x&accion=stamp')).toBeNull()
    expect(readProfileReturn('?obra=x&accion=borrar')).toBeNull()
    expect(readProfileReturn('?accion=like')).toBeNull()
    expect(readProfileReturn(`?obra=${'a'.repeat(301)}&accion=like`)).toBeNull()
    expect(readProfileReturn('')).toBeNull()
  })
})

describe('withoutReturnParams', () => {
  it('drops only the return params', () => {
    expect(withoutReturnParams('?obra=x&accion=like')).toBe('')
    expect(withoutReturnParams('?utm_source=ig&obra=x&accion=like')).toBe('?utm_source=ig')
  })
})

describe('consumeProfileIntent', () => {
  it('hands the pending action to its own obra exactly once', () => {
    armProfileReturn({ slug: 'a', intent: 'like' })
    expect(consumeProfileIntent('b', 'like')).toBe(false)
    expect(consumeProfileIntent('a', 'comment')).toBe(false)
    expect(consumeProfileIntent('a', 'like')).toBe(true)
    expect(consumeProfileIntent('a', 'like')).toBe(false)
  })
})
