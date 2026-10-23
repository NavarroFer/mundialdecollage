import { describe, expect, it, vi } from 'vitest'
import { applyAudioVolume, type VolumeRoute } from './audio'

describe('gallery audio volume', () => {
  it('uses gain even when a mobile media element accepts ineffective volume writes', () => {
    const audio = { volume: .1, muted: true } as HTMLAudioElement
    const setTargetAtTime = vi.fn()
    const route = { context: { currentTime: 12 }, gain: { gain: { setTargetAtTime } } } as unknown as VolumeRoute
    applyAudioVolume(audio, route, 50, false)
    expect(audio.volume).toBe(1)
    expect(audio.muted).toBe(false)
    expect(setTargetAtTime).toHaveBeenCalledWith(.25, 12, .02)
    applyAudioVolume(audio, route, 50, true)
    expect(audio.muted).toBe(true)
    expect(setTargetAtTime).toHaveBeenLastCalledWith(0, 12, .02)
  })
  it('unmutes immediately and restores the chosen level before a selected song plays', () => {
    const audio = { volume: 0, muted: true } as HTMLAudioElement
    applyAudioVolume(audio, null, 60, false)
    expect(audio.muted).toBe(false)
    expect(audio.volume).toBe(.36)
  })
})
