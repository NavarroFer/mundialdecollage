'use client'

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check } from 'lucide-react'
import { useInteractionStore } from '../interaction/store'
import { useTouchStore } from '../mobile/touchStore'
import { joystickStep, keyStep, TUTORIAL_STEPS, type TutorialStep } from '../tutorial/steps'
import styles from '../gallery-theme.module.css'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'mdc-gallery-tutorial-done'
// Long enough to read "¡Listo!" before the panel goes away.
const FINISHED_LINGER_MS = 2500

// Only read on render; the panel's own dismissed state covers the moment it's written.
const noopSubscribe = () => () => {}
function readSeen() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}
function markSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1')
  } catch {}
}

const joystickIcons = { forward: ArrowUp, left: ArrowLeft, right: ArrowRight, backward: ArrowDown }

const labels: Record<TutorialStep, string> = {
  forward: 'Adelante',
  left: 'Izquierda',
  right: 'Derecha',
  backward: 'Atrás',
  interact: 'Ver una obra',
}

const keys: Record<TutorialStep, string> = { forward: 'W', left: 'A', right: 'D', backward: 'S', interact: 'E' }

function StepKey({ step, isTouchDevice }: { step: TutorialStep; isTouchDevice: boolean }): ReactNode {
  if (isTouchDevice && step !== 'interact') {
    const Icon = joystickIcons[step]
    return (
      <span className={cn(styles.tutorialKey, 'rounded-full')} aria-label={`Joystick hacia ${labels[step].toLowerCase()}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
    )
  }
  return <kbd className={styles.tutorialKey}>{keys[step]}</kbd>
}

export function ControlsTutorial({ active, isTouchDevice }: { active: boolean; isTouchDevice: boolean }) {
  const seenBefore = useSyncExternalStore(noopSubscribe, readSeen, () => true)
  const openId = useInteractionStore((state) => state.openId)
  const [done, setDone] = useState<ReadonlySet<TutorialStep>>(() => new Set())
  const [dismissed, setDismissed] = useState(false)

  const tracking = active && !seenBefore && !dismissed
  const allDone = done.size === TUTORIAL_STEPS.length
  const showing = tracking && !openId

  useEffect(() => {
    if (!tracking) return
    const complete = (step: TutorialStep | null) => {
      if (step) setDone((previous) => (previous.has(step) ? previous : new Set(previous).add(step)))
    }

    function handleKeyDown(event: KeyboardEvent) {
      // Typing in the obra modal's form shouldn't tick off movement.
      if (useInteractionStore.getState().openId) return
      complete(keyStep(event.code))
    }
    window.addEventListener('keydown', handleKeyDown)
    const unsubscribeTouch = useTouchStore.subscribe((state) => complete(joystickStep(state.moveX, state.moveZ)))
    // Opening an obra is the real goal of the E step, whether by key or the mobile button.
    const unsubscribeInteraction = useInteractionStore.subscribe((state, previous) => {
      if (state.openId && !previous.openId) complete('interact')
    })
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      unsubscribeTouch()
      unsubscribeInteraction()
    }
  }, [tracking])

  // The last step is usually opening an obra, so wait until its modal is closed
  // and the visitor can actually see the finished checklist.
  useEffect(() => {
    if (!allDone || !showing) return
    const timer = setTimeout(() => {
      markSeen()
      setDismissed(true)
    }, FINISHED_LINGER_MS)
    return () => clearTimeout(timer)
  }, [allDone, showing])

  if (!showing) return null

  return (
    <section
      aria-label="Tutorial de controles"
      className={`${styles.hudPanel} animate-in fade-in slide-in-from-left-2 pointer-events-none absolute top-28 left-4 z-20 w-56 px-3 py-2.5 text-xs duration-300`}
    >
      <header className="mb-2 flex items-center justify-between font-extrabold tracking-[0.14em] uppercase">
        <span>{allDone ? '¡Listo! Buen recorrido' : 'Controles'}</span>
        {!allDone && <span className="opacity-60">{done.size}/{TUTORIAL_STEPS.length}</span>}
      </header>
      <ul className="space-y-1.5">
        {TUTORIAL_STEPS.map((step) => {
          const stepDone = done.has(step)
          return (
            <li key={step} className={cn(styles.tutorialStep, stepDone && styles.tutorialStepDone)}>
              <StepKey step={step} isTouchDevice={isTouchDevice} />
              <span className="flex-1 font-semibold">
                {step === 'interact'
                  ? isTouchDevice
                    ? 'Acercate a una obra y tocá E'
                    : 'Acercate a una obra y apretá E'
                  : labels[step]}
              </span>
              {stepDone && <Check className={cn(styles.tutorialCheck, 'h-4 w-4 shrink-0')} aria-label="Hecho" />}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
