'use client'

import { useVinylStore } from '../vinyl/store'
import { useArcadeStore } from '../arcade/store'
import { useI18n } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/format'
import { useClubDoorStore } from '../club/store'
import { useClubHostStore } from '../club/host'
import { useInteractionStore } from '../interaction/store'
import { useNavigationStore } from '../navigation/store'
import { useWallStore } from '../wall/store'

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Pointer } from 'lucide-react'
import { interact } from '../interaction/interact'
import { useTapHintStore } from './tapHintStore'
import { useTouchStore } from './touchStore'
import type { GalleryTheme } from '../themes'
import styles from '../gallery-theme.module.css'

const JOYSTICK_RADIUS = 55
// A finger that moves less than this, and lifts quickly, tapped.
const TAP_PX = 8
const TAP_MS = 600
const STICK_MARGIN_PX = 24
const HINT_KEY = 'mdc-gallery-touch-hint-seen'
const HINT_MS = 3000
const TAP_HINT_KEY = 'mdc-gallery-tap-hint-seen'

type Vec2 = { x: number; y: number }

export function TouchControls({ theme: _theme, hostName }: { theme: GalleryTheme; hostName?: string }) {
  const { m } = useI18n()
  const vinyl = useVinylStore((state) => state.aiming)
  const arcade = useArcadeStore((state) => state.aiming)
  const targetId = useInteractionStore((state) => state.targetId)
  const aimingAtWall = useWallStore((state) => state.aiming && !state.placing)
  const door = useClubDoorStore((state) => (state.aiming ? state.next : null))
  const host = useClubHostStore((state) => state.aiming)
  const sticksHint = useSticksHint()
  const layerRef = useRef<HTMLDivElement>(null)
  const [moveKnobOffset, setMoveKnobOffset] = useState<Vec2>({ x: 0, y: 0 })
  const [lookKnobOffset, setLookKnobOffset] = useState<Vec2>({ x: 0, y: 0 })

  // React's synthetic touchmove is registered passive (so page scrolling
  // stays smooth by default), which silently breaks preventDefault — these
  // listeners are attached natively instead so touchmove can opt out.
  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return

    const joystickTouchId = { current: null as number | null }
    const joystickOriginPoint = { current: null as Vec2 | null }
    const lookTouchId = { current: null as number | null }
    const lookLast = { current: { x: 0, y: 0 } }
    // The look finger, while it could still be a tap on an obra.
    let tap: { x: number; y: number; at: number } | null = null

    // A thumb on the joystick's circle (and a thumb's width around it)
    // walks from the stick's center, as before. Anywhere else in the lower
    // left quarter it walks too, from where it landed: thumbs missed the
    // small circle. A quick tap there still opens an obra under it.
    function isStick(x: number, y: number) {
      const stick = layer!.querySelector('[data-move-stick]')?.getBoundingClientRect()
      if (!stick) return false
      return x >= stick.left - STICK_MARGIN_PX && x <= stick.right + STICK_MARGIN_PX && y >= stick.top - STICK_MARGIN_PX && y <= stick.bottom + STICK_MARGIN_PX
    }
    const isLowerLeft = (x: number, y: number) => x < window.innerWidth / 2 && y > window.innerHeight / 2
    // The walk finger, while it landed off the stick and could still be a tap.
    let moveTap: { x: number; y: number; at: number } | null = null

    function onTouchStart(event: TouchEvent) {
      for (const touch of Array.from(event.changedTouches)) {
        if (joystickTouchId.current === null && isStick(touch.clientX, touch.clientY)) {
          joystickTouchId.current = touch.identifier
          moveTap = null
          // The stick remains visibly anchored on screen. Its knob follows the
          // finger from the moment it lands, like a conventional gamepad.
          const landscape = window.matchMedia('(orientation: landscape)').matches
          const horizontalInset = landscape ? 0.07 : 0.12
          const verticalInset = landscape ? 0.07 : 0.08
          joystickOriginPoint.current = {
            x: window.innerWidth * horizontalInset + JOYSTICK_RADIUS,
            y: window.innerHeight * (1 - verticalInset) - JOYSTICK_RADIUS,
          }
          setMoveKnobOffset({ x: 0, y: 0 })
        } else if (joystickTouchId.current === null && isLowerLeft(touch.clientX, touch.clientY)) {
          joystickTouchId.current = touch.identifier
          joystickOriginPoint.current = { x: touch.clientX, y: touch.clientY }
          moveTap = event.touches.length > 1 ? null : { x: touch.clientX, y: touch.clientY, at: performance.now() }
          setMoveKnobOffset({ x: 0, y: 0 })
        } else if (lookTouchId.current === null && joystickTouchId.current !== touch.identifier) {
          // A second finger down means a gesture, not a tap.
          tap = event.touches.length > 1 ? null : { x: touch.clientX, y: touch.clientY, at: performance.now() }
          lookTouchId.current = touch.identifier
          lookLast.current = { x: touch.clientX, y: touch.clientY }
          setLookKnobOffset({ x: 0, y: 0 })
        }
      }
    }

    function onTouchMove(event: TouchEvent) {
      let handled = false
      for (const touch of Array.from(event.changedTouches)) {
        if (touch.identifier === joystickTouchId.current && joystickOriginPoint.current) {
          handled = true
          if (moveTap) {
            if (Math.hypot(touch.clientX - moveTap.x, touch.clientY - moveTap.y) <= TAP_PX) continue
            moveTap = null
          }
          const origin = joystickOriginPoint.current
          const dx = touch.clientX - origin.x
          const dy = touch.clientY - origin.y
          const length = Math.hypot(dx, dy)
          const clamped = Math.min(length, JOYSTICK_RADIUS)
          const angle = Math.atan2(dy, dx)
          const offsetX = Math.cos(angle) * clamped
          const offsetY = Math.sin(angle) * clamped
          setMoveKnobOffset({ x: offsetX, y: offsetY })
          useTouchStore.getState().setMove(offsetX / JOYSTICK_RADIUS, -offsetY / JOYSTICK_RADIUS)
        } else if (touch.identifier === lookTouchId.current) {
          handled = true
          if (tap && Math.hypot(touch.clientX - tap.x, touch.clientY - tap.y) > TAP_PX) tap = null
          const dx = touch.clientX - lookLast.current.x
          const dy = touch.clientY - lookLast.current.y
          lookLast.current = { x: touch.clientX, y: touch.clientY }
          setLookKnobOffset((previous) => {
            const nextX = Math.max(-JOYSTICK_RADIUS, Math.min(JOYSTICK_RADIUS, previous.x + dx))
            const nextY = Math.max(-JOYSTICK_RADIUS, Math.min(JOYSTICK_RADIUS, previous.y + dy))
            return { x: nextX, y: nextY }
          })
          useTouchStore.getState().addLookDelta(dx, dy)
        }
      }
      if (handled) event.preventDefault()
    }

    function onTouchEnd(event: TouchEvent) {
      for (const touch of Array.from(event.changedTouches)) {
        if (touch.identifier === joystickTouchId.current) {
          if (event.type === 'touchend' && moveTap && performance.now() - moveTap.at < TAP_MS) useNavigationStore.getState().requestPoint(touch.clientX, touch.clientY)
          moveTap = null
          joystickTouchId.current = null
          joystickOriginPoint.current = null
          setMoveKnobOffset({ x: 0, y: 0 })
          useTouchStore.getState().setMove(0, 0)
        } else if (touch.identifier === lookTouchId.current) {
          if (event.type === 'touchend' && tap && performance.now() - tap.at < TAP_MS) useNavigationStore.getState().requestPoint(touch.clientX, touch.clientY)
          tap = null
          lookTouchId.current = null
          setLookKnobOffset({ x: 0, y: 0 })
        }
      }
    }

    layer.addEventListener('touchstart', onTouchStart, { passive: true })
    layer.addEventListener('touchmove', onTouchMove, { passive: false })
    layer.addEventListener('touchend', onTouchEnd, { passive: true })
    layer.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      useTouchStore.getState().setMove(0, 0)
      layer.removeEventListener('touchstart', onTouchStart)
      layer.removeEventListener('touchmove', onTouchMove)
      layer.removeEventListener('touchend', onTouchEnd)
      layer.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [])

  return (
    <div ref={layerRef} className="absolute inset-0 z-20" style={{ touchAction: 'none' }}>
      <VirtualStick move className={styles.moveStick} offset={moveKnobOffset} />
      <VirtualStick className={styles.lookStick} offset={lookKnobOffset} />
      {sticksHint ? <TouchHint /> : <ArtworkTapHint />}

      {(vinyl || arcade || targetId || aimingAtWall || door || host) && <button
        type="button"
        onTouchStart={(event) => {
          event.stopPropagation()
        }}
        onClick={() => interact()}
        className={`${styles.hudButton} pointer-events-auto absolute right-[7%] bottom-[calc(7%+7.5rem)] flex min-h-12 max-w-48 items-center justify-center px-4 text-sm active:scale-95`}
      >
        {vinyl ? 'Elegir música' : arcade ? 'Jugar Snake' : targetId ? m.gallery.viewArtwork : host && hostName ? fmt(m.gallery.clubHost.prompt, { name: hostName }) : door ? fmt(m.gallery.clubDoor.prompt, { name: door.artistName }) : m.gallery.wall.prompt}
      </button>}
    </div>
  )
}

function VirtualStick({ className, offset, move = false }: { className: string; offset: Vec2; move?: boolean }) {
  return (
    <div data-move-stick={move || undefined} className={`${className} pointer-events-none absolute h-28 w-28 rounded-full border-2 border-paper/45 bg-paper/10`} aria-hidden="true">
      <div
        className="absolute h-12 w-12 rounded-full border border-ink/15 bg-paper/70 shadow-sm transition-transform duration-75"
        style={{ left: 32 + offset.x, top: 32 + offset.y }}
      />
    </div>
  )
}

function seen(key: string) {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return true
  }
}

function markSeen(key: string) {
  try {
    window.localStorage.setItem(key, '1')
  } catch {}
}

const noSubscription = () => () => {}

// The first time on a phone, for HINT_MS: which thumb walks and which looks.
// Marked as seen once it has been on screen the whole time, so leaving right
// away shows it again next visit.
function useSticksHint() {
  const firstVisit = useSyncExternalStore(noSubscription, () => !seen(HINT_KEY), () => false)
  const [done, setDone] = useState(false)
  const visible = firstVisit && !done
  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(() => {
      markSeen(HINT_KEY)
      setDone(true)
    }, HINT_MS)
    return () => clearTimeout(timer)
  }, [visible])
  return visible
}

// A finger dragging over each stick.
function TouchHint() {
  const { m } = useI18n()
  return (
    <div className="animate-in fade-in pointer-events-none absolute inset-0 z-30 duration-300 motion-reduce:animate-none" role="status">
      <HintBubble className={styles.touchHintMove} finger={styles.touchHintFinger} label={m.gallery.tutorial.touchMove} />
      <HintBubble className={styles.touchHintLook} finger={styles.touchHintFingerLook} label={m.gallery.tutorial.touchLook} />
    </div>
  )
}

function HintBubble({ className, finger, label }: { className: string; finger: string; label: string }) {
  return (
    <div className={`${className} absolute flex h-28 w-28 items-center justify-center rounded-full border-2 border-paper bg-paper/25`}>
      <span className="absolute bottom-full mb-3 w-36 rounded-2xl bg-ink px-3 py-1.5 text-center text-sm leading-tight font-semibold text-paper shadow-md">{label}</span>
      <Pointer className={`${finger} size-10 text-paper drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]`} aria-hidden="true" />
    </div>
  )
}

// Where the Pointer icon's fingertip is, in a size-10 (40px) icon.
const FINGERTIP = { x: 13, y: 3 }

// After the sticks' hint, the first time on a phone: a finger tapping the
// obra in clearest view (TapHintTracker finds it), until the visitor opens
// one. It moves with the obra on screen without re-rendering.
function ArtworkTapHint() {
  const { m } = useI18n()
  const firstVisit = useSyncExternalStore(noSubscription, () => !seen(TAP_HINT_KEY), () => false)
  const shown = useTapHintStore((state) => state.spot !== null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!firstVisit) return
    useTapHintStore.setState({ active: true })
    const unsubscribe = useInteractionStore.subscribe((state) => {
      if (state.openId) markSeen(TAP_HINT_KEY)
    })
    return () => {
      unsubscribe()
      useTapHintStore.setState({ active: false, spot: null })
    }
  }, [firstVisit])

  // Before paint, so it never flashes at the corner.
  useLayoutEffect(() => {
    if (!shown) return
    const place = ({ spot }: { spot: { x: number; y: number } | null }) => {
      if (spot && ref.current) ref.current.style.transform = `translate(${spot.x}px, ${spot.y}px)`
    }
    place(useTapHintStore.getState())
    return useTapHintStore.subscribe(place)
  }, [shown])

  if (!firstVisit || !shown) return null
  return (
    <div ref={ref} className="pointer-events-none absolute top-0 left-0 z-30" role="status">
      <div className="animate-in fade-in relative duration-300 motion-reduce:animate-none">
        <span className={`${styles.tapHintRing} absolute -top-7 -left-7 size-14 rounded-full border-2 border-paper`} aria-hidden="true" />
        <span className={`${styles.tapHintBubble} absolute bottom-10 left-0 w-max max-w-44 -translate-x-1/2 rounded-2xl bg-ink px-3 py-1.5 text-center text-sm leading-tight font-semibold text-paper shadow-md`}>{m.gallery.tutorial.touchArtwork}</span>
        <Pointer
          className={`${styles.tapHintFinger} absolute size-10 text-paper drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]`}
          style={{ left: -FINGERTIP.x, top: -FINGERTIP.y }}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
