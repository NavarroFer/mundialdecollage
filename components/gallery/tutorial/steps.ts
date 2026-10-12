import type { ControlMode } from '../preferences/store'

/** Learning by doing, one thing at a time, in the order a first visit needs them. */
export const LEARN_STEPS = ['look', 'move', 'open'] as const
export type LearnStep = (typeof LEARN_STEPS)[number]

/**
 * Clicks and keys (or taps and the joystick) always both walk; what differs
 * is how a computer looks around: dragging with a free cursor, or the mouse
 * captured with a crosshair, the videogame way.
 */
export type ControlScheme = 'keys' | 'click' | 'tap'

export function controlScheme(touch: boolean, mode: ControlMode): ControlScheme {
  if (touch) return 'tap'
  return mode === 'point' ? 'click' : 'keys'
}

/** The tutorial message that says how to do each step, per scheme (keys of `gallery.tutorial`). */
export const HOW_TO = {
  keys: { look: 'lookMouse', move: 'moveKeys', open: 'openKey' },
  click: { look: 'lookDrag', move: 'moveClick', open: 'openClick' },
  tap: { look: 'lookTouch', move: 'moveTap', open: 'openTap' },
} as const satisfies Record<ControlScheme, Record<LearnStep, string>>

/** The first step not done yet, or null when they all are. */
export function nextStep(done: ReadonlySet<LearnStep>): LearnStep | null {
  return LEARN_STEPS.find((step) => !done.has(step)) ?? null
}

type Pose = { x: number; z: number; heading: number }

// Enough to be on purpose, not a thumb resting on the stick or a twitch.
const WALKED_METERS = 0.8
const TURNED_RADIANS = 0.5
// Further than this between two samples was a jump (resuming at an obra), not a walk.
const TELEPORT_METERS = 3

/**
 * Watches the player's pose (from the minimap tracker) and says which steps
 * it completes: walking far enough is "move", turning far enough is "look",
 * whatever control did it. Poses that aren't the visitor's doing (the camera
 * gliding to an open obra) are passed with `counted` false.
 */
export function createPoseTracker() {
  let last: Pose | null = null
  let walked = 0
  let turned = 0
  return (pose: Pose, counted = true): LearnStep[] => {
    if (last && counted) {
      const step = Math.hypot(pose.x - last.x, pose.z - last.z)
      if (step < TELEPORT_METERS) walked += step
      turned += Math.abs(Math.atan2(Math.sin(pose.heading - last.heading), Math.cos(pose.heading - last.heading)))
    }
    last = pose
    const done: LearnStep[] = []
    if (turned >= TURNED_RADIANS) done.push('look')
    if (walked >= WALKED_METERS) done.push('move')
    return done
  }
}
