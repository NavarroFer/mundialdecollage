import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createConnectionKeeper, parseHomeStats } from './home-stats'

describe('parseHomeStats', () => {
  it('reads the totals the database sends', () => {
    expect(parseHomeStats({ artworks: 635, countries: 30, received: 1200 })).toEqual({ artworks: 635, countries: 30, received: 1200 })
  })
  it('ignores fields it does not know', () => {
    expect(parseHomeStats({ artworks: 1, countries: 1, received: 2, id: 'x' })).toEqual({ artworks: 1, countries: 1, received: 2 })
  })
  it('rejects anything that is not three whole, non-negative counts', () => {
    expect(parseHomeStats(null)).toBeNull()
    expect(parseHomeStats('635')).toBeNull()
    expect(parseHomeStats({ artworks: 635, countries: 30 })).toBeNull()
    expect(parseHomeStats({ artworks: '635', countries: 30, received: 1 })).toBeNull()
    expect(parseHomeStats({ artworks: 1.5, countries: 30, received: 1 })).toBeNull()
    expect(parseHomeStats({ artworks: -1, countries: 30, received: 1 })).toBeNull()
  })
})

describe('createConnectionKeeper', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function setup() {
    const close = vi.fn()
    const open = vi.fn(() => close)
    return { open, close, keeper: createConnectionKeeper(open, 30_000) }
  }

  it('opens one connection however many counters watch', () => {
    const { open, keeper } = setup()
    keeper.watch()
    keeper.watch()
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('lets go a while after the last counter stops watching', () => {
    const { close, keeper } = setup()
    keeper.watch()
    keeper.watch()
    keeper.unwatch()
    vi.advanceTimersByTime(60_000)
    expect(close).not.toHaveBeenCalled()
    keeper.unwatch()
    vi.advanceTimersByTime(29_999)
    expect(close).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('keeps the connection when a counter comes back before the delay', () => {
    const { open, close, keeper } = setup()
    keeper.watch()
    keeper.unwatch()
    vi.advanceTimersByTime(10_000)
    keeper.watch()
    vi.advanceTimersByTime(60_000)
    expect(close).not.toHaveBeenCalled()
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('opens a new connection once the old one was let go', () => {
    const { open, close, keeper } = setup()
    keeper.watch()
    keeper.unwatch()
    vi.advanceTimersByTime(30_000)
    keeper.watch()
    expect(close).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledTimes(2)
  })

  it('never counts below zero watchers', () => {
    const { close, keeper } = setup()
    keeper.unwatch()
    keeper.watch()
    vi.advanceTimersByTime(60_000)
    expect(close).not.toHaveBeenCalled()
  })
})
