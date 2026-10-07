'use client'

import { useI18n } from '@/lib/i18n/client'
import { useInteractionStore } from '../interaction/store'
import { useWallStore } from '../wall/store'

import { useEffect, useRef, useState } from 'react'
import { interact } from '../interaction/interact'
import { useTouchStore } from './touchStore'
import type { GalleryTheme } from '../themes'
import styles from '../gallery-theme.module.css'

const JOYSTICK_RADIUS = 55

type Vec2 = { x: number; y: number }

export function TouchControls({ theme: _theme }: { theme: GalleryTheme }) {
  const { m } = useI18n()
  const targetId = useInteractionStore((state) => state.targetId)
  const aimingAtWall = useWallStore((state) => state.aiming && !state.placing)
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

    function isMoveZone(x: number, y: number) {
      return x < window.innerWidth * 0.5 && y > window.innerHeight * 0.45
    }

    function onTouchStart(event: TouchEvent) {
      for (const touch of Array.from(event.changedTouches)) {
        if (joystickTouchId.current === null && isMoveZone(touch.clientX, touch.clientY)) {
          joystickTouchId.current = touch.identifier
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
        } else if (lookTouchId.current === null && joystickTouchId.current !== touch.identifier) {
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
          joystickTouchId.current = null
          joystickOriginPoint.current = null
          setMoveKnobOffset({ x: 0, y: 0 })
          useTouchStore.getState().setMove(0, 0)
        } else if (touch.identifier === lookTouchId.current) {
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
      <VirtualStick className={styles.moveStick} offset={moveKnobOffset} />
      <VirtualStick className={styles.lookStick} offset={lookKnobOffset} />

      {(targetId || aimingAtWall) && <button
        type="button"
        onTouchStart={(event) => {
          event.stopPropagation()
        }}
        onClick={() => interact()}
        className={`${styles.hudButton} pointer-events-auto absolute right-[7%] bottom-[calc(7%+7.5rem)] flex min-h-12 max-w-48 items-center justify-center px-4 text-sm active:scale-95`}
      >
        {targetId ? m.gallery.viewArtwork : m.gallery.wall.prompt}
      </button>}
    </div>
  )
}

function VirtualStick({ className, offset }: { className: string; offset: Vec2 }) {
  return (
    <div className={`${className} pointer-events-none absolute h-28 w-28 rounded-full border-2 border-paper/45 bg-paper/10`} aria-hidden="true">
      <div
        className="absolute h-12 w-12 rounded-full border border-ink/15 bg-paper/70 shadow-sm transition-transform duration-75"
        style={{ left: 32 + offset.x, top: 32 + offset.y }}
      />
    </div>
  )
}
