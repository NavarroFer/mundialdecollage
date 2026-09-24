import { describe, expect, it } from 'vitest'
import { createLookTracker, joystickStep, keyStep } from './steps'

describe('controls tutorial steps', () => {
  it('maps WASD and arrows to movement steps', () => {
    expect(keyStep('KeyW')).toBe('forward')
    expect(keyStep('ArrowLeft')).toBe('left')
    expect(keyStep('KeyD')).toBe('right')
    expect(keyStep('KeyS')).toBe('backward')
  })
  it('leaves non-movement keys to their own steps', () => {
    expect(keyStep('KeyE')).toBeNull()
    expect(keyStep('ShiftLeft')).toBeNull()
    expect(keyStep('KeyQ')).toBeNull()
  })
  it('ignores a joystick barely pushed', () => {
    expect(joystickStep(0.1, 0.2)).toBeNull()
  })
  it('reads the joystick by its dominant axis', () => {
    expect(joystickStep(0.2, 0.9)).toBe('forward')
    expect(joystickStep(-0.1, -0.8)).toBe('backward')
    expect(joystickStep(-0.7, 0.3)).toBe('left')
    expect(joystickStep(0.6, -0.4)).toBe('right')
  })
  it('counts looking around only after enough travel in any direction', () => {
    const look = createLookTracker(100)
    expect(look(30, 0)).toBe(false)
    expect(look(-30, 20)).toBe(false)
    expect(look(0, -20)).toBe(true)
  })
})
