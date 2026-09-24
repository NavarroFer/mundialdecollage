import { keyboardMap, type Controls } from '../player/controls'

type MoveStep = Extract<Controls, 'forward' | 'left' | 'right' | 'backward'>
export type TutorialStep = MoveStep | 'look' | 'interact'

export const TUTORIAL_STEPS: TutorialStep[] = ['forward', 'left', 'right', 'backward', 'look', 'interact']

const MOVE_STEPS = new Set<TutorialStep>(['forward', 'left', 'right', 'backward'])

// A resting thumb drifts a little; only a deliberate push counts.
const JOYSTICK_DEADZONE = 0.35

/** Movement step for a pressed key, going through the same map the player uses (so arrows count too). */
export function keyStep(code: string): TutorialStep | null {
  const name = keyboardMap.find((entry) => entry.keys.includes(code))?.name
  return name && MOVE_STEPS.has(name as TutorialStep) ? (name as TutorialStep) : null
}

/** Movement step for the joystick's dominant axis. moveZ positive = forward. */
export function joystickStep(moveX: number, moveZ: number): TutorialStep | null {
  if (Math.hypot(moveX, moveZ) < JOYSTICK_DEADZONE) return null
  if (Math.abs(moveZ) >= Math.abs(moveX)) return moveZ > 0 ? 'forward' : 'backward'
  return moveX > 0 ? 'right' : 'left'
}

// Enough mouse or finger travel to count as looking around, not a twitch.
const LOOK_TRAVEL_PX = 250

/** Accumulates look drags; returns true once they add up to a real look around. */
export function createLookTracker(threshold = LOOK_TRAVEL_PX) {
  let travelled = 0
  return (dx: number, dy: number) => (travelled += Math.abs(dx) + Math.abs(dy)) >= threshold
}
