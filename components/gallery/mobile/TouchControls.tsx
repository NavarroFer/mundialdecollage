'use client'

import { useEffect, useRef, useState } from 'react'
import { useInteractionStore } from '../interaction/store'
import { useTouchStore } from './touchStore'

const JOYSTICK_RADIUS = 55

type Vec2 = { x: number; y: number }

export function TouchControls() {
  const layerRef = useRef<HTMLDivElement>(null)
  const [joystickOrigin, setJoystickOrigin] = useState<Vec2 | null>(null)
  const [knobOffset, setKnobOffset] = useState<Vec2>({ x: 0, y: 0 })

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
          joystickOriginPoint.current = { x: touch.clientX, y: touch.clientY }
          setJoystickOrigin({ x: touch.clientX, y: touch.clientY })
          setKnobOffset({ x: 0, y: 0 })
        } else if (lookTouchId.current === null && joystickTouchId.current !== touch.identifier) {
          lookTouchId.current = touch.identifier
          lookLast.current = { x: touch.clientX, y: touch.clientY }
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
          setKnobOffset({ x: offsetX, y: offsetY })
          useTouchStore.getState().setMove(offsetX / JOYSTICK_RADIUS, -offsetY / JOYSTICK_RADIUS)
        } else if (touch.identifier === lookTouchId.current) {
          handled = true
          const dx = touch.clientX - lookLast.current.x
          const dy = touch.clientY - lookLast.current.y
          lookLast.current = { x: touch.clientX, y: touch.clientY }
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
          setJoystickOrigin(null)
          setKnobOffset({ x: 0, y: 0 })
          useTouchStore.getState().setMove(0, 0)
        } else if (touch.identifier === lookTouchId.current) {
          lookTouchId.current = null
        }
      }
    }

    layer.addEventListener('touchstart', onTouchStart, { passive: true })
    layer.addEventListener('touchmove', onTouchMove, { passive: false })
    layer.addEventListener('touchend', onTouchEnd, { passive: true })
    layer.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      layer.removeEventListener('touchstart', onTouchStart)
      layer.removeEventListener('touchmove', onTouchMove)
      layer.removeEventListener('touchend', onTouchEnd)
      layer.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [])

  return (
    <div ref={layerRef} className="absolute inset-0 z-20" style={{ touchAction: 'none' }}>
      {joystickOrigin && (
        <div
          className="pointer-events-none absolute h-28 w-28 rounded-full border-2 border-paper/50 bg-paper/10"
          style={{ left: joystickOrigin.x - 56, top: joystickOrigin.y - 56 }}
        >
          <div
            className="absolute h-12 w-12 rounded-full bg-paper/70"
            style={{
              left: 56 - 24 + knobOffset.x,
              top: 56 - 24 + knobOffset.y,
            }}
          />
        </div>
      )}

      <button
        type="button"
        onTouchStart={(event) => {
          event.stopPropagation()
          useInteractionStore.getState().toggle()
        }}
        className="pointer-events-auto absolute right-8 bottom-10 flex h-16 w-16 items-center justify-center rounded-full bg-paper/80 font-display text-xl text-ink shadow-lg active:scale-95"
      >
        E
      </button>
    </div>
  )
}
