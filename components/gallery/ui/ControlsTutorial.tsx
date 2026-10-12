'use client'

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Check, CircleDot, Eye, Hand, Mouse, MousePointerClick, Pointer } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/format'
import { useInteractionStore } from '../interaction/store'
import { usePlayerTrackerStore } from '../minimap/store'
import { useGalleryPreferences } from '../preferences/store'
import { HOW_TO, LEARN_STEPS, controlScheme, createPoseTracker, nextStep, type ControlScheme, type LearnStep } from '../tutorial/steps'
import { useTutorialStore } from '../tutorial/store'
import styles from '../gallery-theme.module.css'

// Long enough to read "¡Listo!" before the card goes away.
const FINISHED_LINGER_MS = 3000

// Only read on render; the card's own dismissed state covers the moment it's written.
const noopSubscribe = () => () => {}
const storageKey = (scheme: ControlScheme) => `mdc-gallery-tutorial-v2-${scheme}`
function readSeen(scheme: ControlScheme) {
  try {
    return window.localStorage.getItem(storageKey(scheme)) === '1'
  } catch {
    return false
  }
}
function markSeen(scheme: ControlScheme) {
  try {
    window.localStorage.setItem(storageKey(scheme), '1')
  } catch {}
}

const key = (label: string) => <kbd key={label} className={styles.tutorialKey}>{label}</kbd>

// What to press or touch for each step, drawn next to the words.
const GLYPHS: Record<ControlScheme, Record<LearnStep, ReactNode>> = {
  keys: { look: <Mouse size={22} />, move: ['W', 'A', 'S', 'D'].map(key), open: key('E') },
  click: { look: <Hand size={22} />, move: <MousePointerClick size={22} />, open: <MousePointerClick size={22} /> },
  stick: { look: <Hand size={22} />, move: <CircleDot size={22} />, open: <Eye size={22} /> },
  tap: { look: <Hand size={22} />, move: <Pointer size={22} />, open: <Pointer size={22} /> },
}

/**
 * Learning by doing: one instruction at a time (look around, walk, open an
 * obra), each in the words of the controls the visitor chose, and it moves
 * on when they do it. Shown once per way of walking, and again on request.
 */
export function ControlsTutorial({ active, isTouchDevice }: { active: boolean; isTouchDevice: boolean }) {
  const mode = useGalleryPreferences((state) => state.controlMode)
  const replays = useTutorialStore((state) => state.replays)
  const scheme = controlScheme(isTouchDevice, mode)
  // Other controls or a replay start over from the first step.
  return <Tutorial key={`${scheme}-${replays}`} active={active} scheme={scheme} touch={isTouchDevice} replay={replays > 0} />
}

function Tutorial({ active, scheme, touch, replay }: { active: boolean; scheme: ControlScheme; touch: boolean; replay: boolean }) {
  const t = useI18n().m.gallery.tutorial
  const seenBefore = useSyncExternalStore(noopSubscribe, () => readSeen(scheme), () => true)
  const openId = useInteractionStore((state) => state.openId)
  const [done, setDone] = useState<ReadonlySet<LearnStep>>(() => new Set())
  const [dismissed, setDismissed] = useState(false)
  const walking = useRef(active)
  useEffect(() => { walking.current = active }, [active])

  const tracking = (replay || !seenBefore) && !dismissed
  const step = nextStep(done)

  useEffect(() => {
    if (!tracking) return
    const complete = (steps: LearnStep[]) => {
      setDone((previous) => (steps.every((step) => previous.has(step)) ? previous : new Set([...previous, ...steps])))
    }
    const track = createPoseTracker()
    // Only the visitor's own moves count, not the camera gliding to an obra.
    const unsubscribePose = usePlayerTrackerStore.subscribe((pose) => complete(track(pose, walking.current)))
    const unsubscribeOpen = useInteractionStore.subscribe((state, previous) => {
      if (state.openId && !previous.openId) complete(['open'])
    })
    return () => {
      unsubscribePose()
      unsubscribeOpen()
    }
  }, [tracking])

  // The last step opens an obra: "¡Listo!" waits until it's closed and the
  // visitor is back in the walk to see it.
  useEffect(() => {
    if (step !== null || !active || !tracking) return
    const timer = setTimeout(() => {
      markSeen(scheme)
      setDismissed(true)
    }, FINISHED_LINGER_MS)
    return () => clearTimeout(timer)
  }, [step, active, tracking, scheme])

  if (!tracking || !active || openId) return null

  const skip = () => {
    markSeen(scheme)
    setDismissed(true)
  }

  return (
    <aside className={`${styles.hudPanel} ${styles.learningCard}`} aria-label={t.label}>
      <div className="flex items-center justify-between gap-3 text-[0.68rem] font-extrabold tracking-[0.14em] uppercase">
        <span>{t.label} · {fmt(t.progress, { current: step ? LEARN_STEPS.indexOf(step) + 1 : LEARN_STEPS.length, total: LEARN_STEPS.length })}</span>
        {step && <button type="button" className="min-h-8 px-1 underline opacity-80 hover:opacity-100" onClick={skip}>{t.skip}</button>}
      </div>
      {step ? (
        <div className="mt-2 flex items-center gap-3" aria-live="polite">
          <span className={styles.learningGlyph} aria-hidden="true">{GLYPHS[scheme][step]}</span>
          <p>
            <strong className="block text-base leading-tight">{t[step]}</strong>
            <span className="text-sm">{t[HOW_TO[scheme][step]]}</span>
          </p>
        </div>
      ) : (
        <p className="mt-2 flex items-center gap-3 text-base font-bold" role="status">
          <span className={styles.learningGlyph} aria-hidden="true"><Check size={22} /></span>
          {t.done}
        </p>
      )}
      <ol className={styles.learningDots} aria-hidden="true">
        {LEARN_STEPS.map((item) => <li key={item} data-done={done.has(item)} data-current={item === step} />)}
      </ol>
      <p className="mt-2 text-xs opacity-75">{touch ? t.helpMenu : t.helpKey}</p>
    </aside>
  )
}
