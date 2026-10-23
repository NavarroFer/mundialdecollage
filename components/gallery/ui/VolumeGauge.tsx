'use client'

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import styles from '../gallery-theme.module.css'
import { cn } from '@/lib/utils'
import { sloshSettled, sloshStep, sloshTilt } from './slosh'

/** Arrow keys move the level this much; with Shift, or PageUp/PageDown, BIG_STEP. */
const STEP = 2
const BIG_STEP = 10
/** A press this close to the level's line takes hold of it where it is, instead of jumping it to the press. */
const GRAB_PX = 10
/** A frame longer than this (a background tab) counts as this. */
const MAX_FRAME = 0.05

const clamp = (value: number) => Math.min(100, Math.max(0, value))

type Grip = { pointer: number; rect: DOMRect; near: boolean; offset: number | null; sent: number }

/**
 * The music's volume as a tank of liquid (slosh.ts): drag it up or down, or
 * use the arrow keys once focused. `onInput` follows the drag; `onChange`
 * comes once it's let go, like an <input type=range>. Drawn frame by frame
 * on the elements, no re-render per frame, and no frames at all at rest.
 */
export function VolumeGauge({ value, onInput, onChange, label }: { value: number; onInput: (value: number) => void; onChange: (value: number) => void; label: string }) {
  const root = useRef<HTMLDivElement>(null)
  const liquid = useRef<HTMLDivElement>(null)
  const marker = useRef<HTMLDivElement>(null)
  const textOver = useRef<HTMLSpanElement>(null)
  const textUnder = useRef<HTMLSpanElement>(null)
  // It fills up from empty when it first shows: the splash draws the eye to it.
  const slosh = useRef({ level: 0, speed: 0 })
  const target = useRef(clamp(value))
  const frame = useRef({ id: 0, last: 0 })
  const grip = useRef<Grip | null>(null)
  const calm = useRef(false)
  const [initial] = useState(() => `${Math.round(clamp(value))}%`)
  const [held, setHeld] = useState(false)

  function paint() {
    const element = root.current
    if (!element) return
    const lean = (Math.tan((sloshTilt(slosh.current, calm.current) * Math.PI) / 180) * element.clientWidth) / 2
    const top = 100 - slosh.current.level
    if (liquid.current) liquid.current.style.clipPath = `polygon(0 calc(${top}% + ${lean}px), 100% calc(${top}% - ${lean}px), 100% 100%, 0 100%)`
    if (marker.current) marker.current.style.transform = `translateY(${((100 - target.current) * element.clientHeight) / 100}px)`
  }

  function tick(now: number) {
    const state = frame.current
    const seconds = state.last ? Math.min((now - state.last) / 1000, MAX_FRAME) : 1 / 120
    state.last = now
    sloshStep(slosh.current, target.current, seconds, calm.current)
    if (!grip.current && sloshSettled(slosh.current, target.current)) slosh.current = { level: target.current, speed: 0 }
    paint()
    const resting = !grip.current && slosh.current.level === target.current && slosh.current.speed === 0
    state.id = resting ? 0 : requestAnimationFrame(tick)
    if (resting) state.last = 0
  }

  function setLevel(level: number, instant = false) {
    target.current = clamp(level)
    if (instant) slosh.current = { level: target.current, speed: 0 }
    const text = `${Math.round(target.current)}%`
    root.current?.setAttribute('aria-valuenow', String(Math.round(target.current)))
    if (textOver.current) textOver.current.textContent = text
    if (textUnder.current) textUnder.current.textContent = text
    if (!frame.current.id) frame.current.id = requestAnimationFrame(tick)
  }

  // Muting drains it and turning the music back on fills it again; a drag
  // already at that level is left alone.
  useLayoutEffect(() => {
    if (grip.current && Math.round(target.current) === value) return
    setLevel(value)
    // setLevel only touches refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  useLayoutEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => { calm.current = reduced.matches }
    sync()
    reduced.addEventListener('change', sync)
    paint()
    const state = frame.current
    return () => {
      reduced.removeEventListener('change', sync)
      cancelAnimationFrame(state.id)
      state.id = 0
    }
  }, [])

  const levelAt = (clientY: number, rect: DOMRect) => clamp(((rect.bottom - clientY) / rect.height) * 100)

  function report() {
    const current = grip.current
    const level = Math.round(target.current)
    if (!current || level === current.sent) return
    current.sent = level
    onInput(level)
  }

  function down(event: PointerEvent<HTMLDivElement>) {
    const element = root.current
    if (!element || grip.current || event.button !== 0) return
    const rect = element.getBoundingClientRect()
    const line = rect.top + ((100 - target.current) / 100) * rect.height
    grip.current = { pointer: event.pointerId, rect, near: Math.abs(event.clientY - line) <= GRAB_PX, offset: null, sent: Math.round(target.current) }
    try { element.setPointerCapture(event.pointerId) } catch {}
    setHeld(true)
    if (grip.current.near) return
    setLevel(levelAt(event.clientY, rect))
    report()
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const current = grip.current
    if (!current || current.pointer !== event.pointerId) return
    const at = levelAt(event.clientY, current.rect)
    if (current.near && current.offset === null) {
      current.offset = target.current - at
      return
    }
    setLevel(at + (current.offset ?? 0))
    report()
  }

  function up(event: { pointerId: number }) {
    const current = grip.current
    if (!current || current.pointer !== event.pointerId) return
    grip.current = null
    try { root.current?.releasePointerCapture(event.pointerId) } catch {}
    setHeld(false)
    // Focus stays only for the keyboard: after a drag, the arrows walk again.
    root.current?.blur()
    onChange(Math.round(target.current))
    if (!frame.current.id) frame.current.id = requestAnimationFrame(tick)
  }

  function key(event: KeyboardEvent<HTMLDivElement>) {
    const level = target.current
    const step = event.shiftKey ? BIG_STEP : STEP
    const next = ({ ArrowUp: level + step, ArrowRight: level + step, ArrowDown: level - step, ArrowLeft: level - step, PageUp: level + BIG_STEP, PageDown: level - BIG_STEP, Home: 0, End: 100 } as Record<string, number>)[event.key]
    if (next === undefined) return
    // Not also a step of the walk (its keys listen on window).
    event.preventDefault()
    event.stopPropagation()
    setLevel(next, true)
    onChange(Math.round(target.current))
  }

  return (
    <div
      ref={root}
      role="slider"
      tabIndex={0}
      aria-label={label}
      title={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamp(value))}
      aria-orientation="vertical"
      data-held={held || undefined}
      className={cn(styles.hudButton, styles.volumeGauge, 'animate-in fade-in duration-300')}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
      onKeyDown={key}
    >
      <span ref={textOver} className={styles.volumeValue} aria-hidden="true">{initial}</span>
      <div ref={liquid} className={styles.volumeLiquid} aria-hidden="true">
        <span ref={textUnder} className={styles.volumeValue}>{initial}</span>
      </div>
      <div className={styles.volumeTicks} aria-hidden="true" />
      <div ref={marker} className={styles.volumeMarker} aria-hidden="true" />
    </div>
  )
}
