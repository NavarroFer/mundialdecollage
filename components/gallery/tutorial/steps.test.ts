import { describe, expect, it } from 'vitest'
import { MESSAGES } from '@/lib/i18n/messages'
import { HOW_TO, LEARN_STEPS, controlScheme, createPoseTracker, nextStep } from './steps'

describe('controlScheme', () => {
  it('picks the way to walk for each device and choice', () => {
    expect(controlScheme(false, 'classic')).toBe('keys')
    expect(controlScheme(false, 'point')).toBe('click')
    expect(controlScheme(true, 'classic')).toBe('stick')
    expect(controlScheme(true, 'point')).toBe('tap')
  })

  it('has an instruction for every step of every scheme, in every language', () => {
    for (const messages of Object.values(MESSAGES)) {
      for (const steps of Object.values(HOW_TO)) {
        for (const step of LEARN_STEPS) expect(messages.gallery.tutorial[steps[step]]).toBeTruthy()
      }
    }
  })
})

describe('nextStep', () => {
  it('teaches one thing at a time, in order', () => {
    expect(nextStep(new Set())).toBe('look')
    expect(nextStep(new Set(['look']))).toBe('move')
    // Doing a later step early doesn't skip the earlier one.
    expect(nextStep(new Set(['move']))).toBe('look')
    expect(nextStep(new Set(['look', 'move', 'open']))).toBeNull()
  })
})

describe('createPoseTracker', () => {
  it('counts a real walk and a real look around, not a twitch', () => {
    const track = createPoseTracker()
    expect(track({ x: 0, z: 0, heading: 0 })).toEqual([])
    expect(track({ x: 0.2, z: 0, heading: 0.1 })).toEqual([])
    expect(track({ x: 0.5, z: 0, heading: 0.6 })).toEqual(['look'])
    expect(track({ x: 0.9, z: 0, heading: 0.6 })).toEqual(['look', 'move'])
  })

  it('turns the short way across ±π', () => {
    const track = createPoseTracker()
    track({ x: 0, z: 0, heading: Math.PI - 0.1 })
    expect(track({ x: 0, z: 0, heading: -Math.PI + 0.1 })).toEqual([])
  })

  it('leaves out what the visitor didn\'t do', () => {
    const track = createPoseTracker()
    track({ x: 0, z: 0, heading: 0 })
    expect(track({ x: 2, z: 0, heading: 2 }, false)).toEqual([])
    expect(track({ x: 2.3, z: 0, heading: 2.1 })).toEqual([])
  })

  it('ignores a jump to an obra', () => {
    const track = createPoseTracker()
    track({ x: 0, z: 0, heading: 0 })
    expect(track({ x: 10, z: 0, heading: 0 })).toEqual([])
  })
})
