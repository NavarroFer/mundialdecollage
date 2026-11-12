import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHoverIntent, isRealMouse } from '@/lib/hover-intent'

function setup() {
  const onOpen = vi.fn()
  const onClose = vi.fn()
  return { onOpen, onClose, intent: createHoverIntent({ onOpen, onClose }) }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('createHoverIntent', () => {
  it('opens only after the pointer rests for a moment', () => {
    const { intent, onOpen } = setup()
    intent.enter()
    vi.advanceTimersByTime(249)
    expect(onOpen).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('does not open for a pointer that only passes over', () => {
    const { intent, onOpen } = setup()
    intent.enter()
    vi.advanceTimersByTime(100)
    intent.leave()
    vi.advanceTimersByTime(1000)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('stays open while the pointer crosses from the trigger to the card', () => {
    const { intent, onOpen, onClose } = setup()
    intent.enter()
    vi.advanceTimersByTime(250)
    intent.leave()
    vi.advanceTimersByTime(100)
    intent.enter()
    vi.advanceTimersByTime(1000)
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes a moment after the pointer leaves for good', () => {
    const { intent, onClose } = setup()
    intent.enter()
    vi.advanceTimersByTime(250)
    intent.leave()
    vi.advanceTimersByTime(149)
    expect(onClose).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('opens at once with the keyboard and closes at once with Escape', () => {
    const { intent, onOpen, onClose } = setup()
    intent.focus()
    expect(onOpen).toHaveBeenCalledTimes(1)
    intent.escape()
    expect(onClose).toHaveBeenCalledTimes(1)
    intent.escape()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does nothing after dispose', () => {
    const { intent, onOpen } = setup()
    intent.enter()
    intent.dispose()
    vi.advanceTimersByTime(1000)
    expect(onOpen).not.toHaveBeenCalled()
  })
})

describe('isRealMouse', () => {
  const media = (matches: boolean) => () => ({ matches })

  it('accepts a mouse on a device that can hover', () => {
    expect(isRealMouse('mouse', media(true))).toBe(true)
  })

  it('does not open for a tap or a pen, nor on a device that cannot hover', () => {
    expect(isRealMouse('touch', media(true))).toBe(false)
    expect(isRealMouse('pen', media(true))).toBe(false)
    expect(isRealMouse('mouse', media(false))).toBe(false)
    expect(isRealMouse('mouse', undefined)).toBe(false)
  })
})
