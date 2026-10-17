'use client'

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Check, File, PencilLine, RotateCw, Search, Terminal, type LucideIcon } from 'lucide-react'

// React Bits' Call Chip (https://reactbits.dev/micro/call-chip): a chip for
// one task whose fill wipes across as its timer ticks, then settles with a
// check, or shakes and offers to try again. Adapted here: lucide icons
// instead of Hugeicons, its words passed in (the site is in nine
// languages), the time as the caller writes it, and its announcements
// optional for a parent that already has a live region. Two of its classes
// did nothing under Tailwind 4 and are written out instead: `scale-x-0` sets
// the `scale` property, which held the fill at zero whatever its transform
// said, and `blur-0` isn't a utility, so the icons never came into focus.

export type CallChipStatus = 'idle' | 'running' | 'done' | 'error'
export type CallChipIcon = 'terminal' | 'file' | 'search' | 'edit'

export interface CallChipProps {
  icon?: CallChipIcon | ReactNode
  name?: string
  argument?: string
  status?: CallChipStatus
  /** How long the task should take: the fill gets to 90% by then and waits. */
  expectedMs?: number
  size?: number
  radius?: number
  color?: string
  surfaceColor?: string
  progressColor?: string
  progressOpacity?: number
  doneColor?: string
  errorColor?: string
  washOpacity?: number
  shake?: number
  showTimer?: boolean
  /** The elapsed time as shown; ticks every frame while running. */
  formatTime?: (ms: number) => string
  /** What each status is called for screen readers, and the retry button's label. */
  labels?: Record<CallChipStatus, string> & { retry: string }
  /** Off when a parent already announces the progress. */
  live?: boolean
  onRetry?: () => void
  className?: string
  style?: CSSProperties
}

type Glyph = 'tool' | 'check' | 'retry'

const HOLD_AT = 0.9
const SHAKE = [0, -1, 1, -0.66, 0.66, -0.33, 0]
const ICONS: Record<CallChipIcon, LucideIcon> = { terminal: Terminal, file: File, search: Search, edit: PencilLine }
const LABELS: NonNullable<CallChipProps['labels']> = { idle: 'queued', running: 'running', done: 'done', error: 'failed', retry: 'Retry' }

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
const glyphOf = (s: CallChipStatus): Glyph => (s === 'done' ? 'check' : s === 'error' ? 'retry' : 'tool')

const GLYPH_CLASS =
  'absolute inset-0 grid place-items-center opacity-0 blur-[3px] [transform:translateY(70%)] data-[state=in]:opacity-100 data-[state=in]:[filter:blur(0)] data-[state=in]:[transform:none] data-[state=in]:[transition:opacity_240ms_cubic-bezier(0.23,1,0.32,1),transform_240ms_cubic-bezier(0.23,1,0.32,1),filter_240ms_cubic-bezier(0.23,1,0.32,1)] data-[state=out]:[transform:translateY(-70%)] data-[state=out]:[transition:opacity_160ms_cubic-bezier(0.23,1,0.32,1),transform_160ms_cubic-bezier(0.23,1,0.32,1),filter_160ms_cubic-bezier(0.23,1,0.32,1)] group-data-[status=done]:data-[state=in]:[color:var(--cc-done)] group-data-[status=error]:data-[state=in]:[color:var(--cc-error)] motion-reduce:[transform:none]! motion-reduce:[filter:none]! group-not-data-[mounted]:transition-none!'

export function CallChip({
  icon = 'terminal',
  name = 'bash',
  argument = 'npm test',
  status = 'running',
  expectedMs = 2500,
  size = 34,
  radius = 10,
  color = 'currentColor',
  surfaceColor = '#27272a',
  progressColor = 'currentColor',
  progressOpacity = 0.08,
  doneColor = '#22c55e',
  errorColor = '#ef4444',
  washOpacity = 0.14,
  shake = 6,
  showTimer = true,
  formatTime = seconds,
  labels = LABELS,
  live = true,
  onRetry,
  className = '',
  style,
}: CallChipProps) {
  const rootRef = useRef<HTMLSpanElement>(null)
  const fillRef = useRef<HTMLSpanElement>(null)
  const timerRef = useRef<HTMLSpanElement>(null)
  const mountedRef = useRef(false)
  const fraction = useRef(0)
  // When the fill started its run, while it's running.
  const runStart = useRef<number | null>(null)
  const elapsed = useRef(0)
  const shakeAnim = useRef<Animation | null>(null)
  const formatRef = useRef(formatTime)
  const [pressed, setPressed] = useState(false)
  // The glyph showing and the one leaving, so the leaving one can roll out.
  const [glyphs, setGlyphs] = useState<{ cur: Glyph; prev: Glyph | null }>({ cur: glyphOf(status), prev: null })
  if (glyphOf(status) !== glyphs.cur) setGlyphs({ cur: glyphOf(status), prev: glyphs.cur })

  useLayoutEffect(() => {
    formatRef.current = formatTime
  })

  const setFraction = (f: number, instant: boolean) => {
    const fill = fillRef.current
    if (!fill) return
    fraction.current = f
    if (instant) fill.style.transition = 'none'
    fill.style.transform = `scaleX(${f})`
    if (instant) {
      void fill.getBoundingClientRect()
      fill.style.transition = ''
    }
  }
  // Where the fill is mid-run, from the clock. Not read off the DOM: by the
  // time a new status gets there, its class has already swapped the running
  // transition for another, which jumps the fill to the end of the run.
  const liveFraction = () =>
    runStart.current === null ? fraction.current : Math.min(HOLD_AT, (HOLD_AT * (performance.now() - runStart.current)) / expectedMs)
  const apply = (s: CallChipStatus, animate: boolean) => {
    if (s === 'running') {
      shakeAnim.current?.cancel()
      setFraction(0, true)
      if (animate) {
        runStart.current = performance.now()
        setFraction(HOLD_AT, false)
      }
      return
    }
    const from = liveFraction()
    runStart.current = null
    if (s === 'done') {
      // From where it was, not from where the run would have ended.
      if (animate) setFraction(from, true)
      setFraction(1, !animate)
    } else if (s === 'error') {
      setFraction(from, true)
      if (animate && shake > 0 && !reduceMotion() && rootRef.current) {
        shakeAnim.current = rootRef.current.animate(
          SHAKE.map((k) => ({ transform: `translateX(${k * shake}px)`, easing: 'cubic-bezier(0.77, 0, 0.175, 1)' })),
          { duration: 450, composite: 'add' },
        )
      }
    } else setFraction(0, true)
  }

  useEffect(() => {
    mountedRef.current = true
    // Transitions only after the first paint, so a chip that mounts done doesn't animate.
    if (rootRef.current) rootRef.current.dataset.mounted = ''
    apply(status, status === 'running')
    return () => {
      mountedRef.current = false
      shakeAnim.current?.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount
  }, [])
  useLayoutEffect(() => {
    if (mountedRef.current) apply(status, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on a status change only
  }, [status])

  // Written straight into the DOM every frame: a re-render per frame would be wasted work.
  useEffect(() => {
    const write = (ms: number) => {
      elapsed.current = ms
      if (timerRef.current) timerRef.current.textContent = formatRef.current(ms)
    }
    if (status !== 'running') {
      if ((status === 'idle' || !elapsed.current) && timerRef.current) timerRef.current.textContent = '—'
      return undefined
    }
    const startedAt = performance.now()
    write(0)
    if (reduceMotion()) {
      const id = setInterval(() => write(performance.now() - startedAt), 100)
      return () => {
        clearInterval(id)
        write(performance.now() - startedAt)
      }
    }
    let raf = 0
    const tick = () => {
      write(performance.now() - startedAt)
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => {
      cancelAnimationFrame(raf)
      write(performance.now() - startedAt)
    }
  }, [status])

  const font = Math.max(11, Math.round(size * 0.38))
  const glyphState = (g: Glyph) => (g === glyphs.cur ? 'in' : g === glyphs.prev ? 'out' : undefined)
  const ToolIcon = typeof icon === 'string' ? (ICONS[icon as CallChipIcon] ?? ICONS.terminal) : null
  const iconSize = font + 2

  return (
    <span
      ref={rootRef}
      role={live ? 'status' : undefined}
      aria-busy={status === 'running' || undefined}
      data-status={status}
      data-pressed={pressed ? '' : undefined}
      className={`group relative box-border inline-flex max-w-full items-center overflow-hidden leading-none whitespace-nowrap select-none [-webkit-touch-callout:none] [height:var(--cc-size)] [padding:0_var(--cc-pad)] [gap:var(--cc-gap)] [border-radius:var(--cc-radius)] [background:var(--cc-surface)] [color:var(--cc-color)] [font-size:var(--cc-font)] [transition:transform_160ms_cubic-bezier(0.23,1,0.32,1)] data-[status=error]:cursor-pointer data-[pressed]:scale-[0.97] motion-reduce:data-[pressed]:scale-100${className ? ` ${className}` : ''}`}
      style={
        {
          '--cc-size': `${size}px`,
          '--cc-font': `${font}px`,
          '--cc-pad': `${Math.round(size * 0.35)}px`,
          '--cc-gap': `${Math.round(font * 0.55)}px`,
          '--cc-radius': `${radius}px`,
          '--cc-color': color,
          '--cc-surface': surfaceColor,
          '--cc-progress': progressColor,
          '--cc-progress-pct': `${progressOpacity * 100}%`,
          '--cc-done': doneColor,
          '--cc-error': errorColor,
          '--cc-wash-pct': `${washOpacity * 100}%`,
          '--cc-expected': `${expectedMs}ms`,
          ...style,
        } as CSSProperties
      }
    >
      <span
        ref={fillRef}
        className="pointer-events-none absolute inset-0 origin-left [transform:scaleX(0)] [clip-path:inset(0_0_0_0)] [background:color-mix(in_srgb,var(--cc-progress)_var(--cc-progress-pct),transparent)] group-data-[status=running]:[transition:transform_var(--cc-expected)_linear] group-data-[status=done]:[clip-path:inset(100%_0_0_0)] group-data-[status=done]:[background:color-mix(in_srgb,var(--cc-done)_var(--cc-wash-pct),transparent)] group-data-[status=done]:[transition:transform_200ms_cubic-bezier(0.23,1,0.32,1),background-color_120ms_ease,clip-path_400ms_cubic-bezier(0.23,1,0.32,1)_200ms] group-data-[status=error]:[background:color-mix(in_srgb,var(--cc-error)_var(--cc-wash-pct),transparent)] group-data-[status=error]:[transition:background-color_200ms_ease] motion-reduce:group-data-[status=done]:[clip-path:inset(0_0_0_0)] motion-reduce:group-data-[status=done]:[transition:background-color_120ms_ease] group-not-data-[mounted]:transition-none!"
        aria-hidden="true"
      />
      <span className="relative flex-none overflow-hidden [width:calc(var(--cc-font)+2px)] [height:calc(var(--cc-font)+2px)]" aria-hidden="true">
        <span className={GLYPH_CLASS} data-state={glyphState('tool')}>
          {ToolIcon ? <ToolIcon size={iconSize} strokeWidth={1.8} /> : icon}
        </span>
        <span className={GLYPH_CLASS} data-state={glyphState('check')}>
          <Check size={iconSize} strokeWidth={2.2} />
        </span>
        <span className={GLYPH_CLASS} data-state={glyphState('retry')}>
          <RotateCw size={iconSize} strokeWidth={2} />
        </span>
      </span>
      <span className="relative font-medium" aria-hidden="true">
        {name}
      </span>
      <span className="relative min-w-0 truncate opacity-[0.72]" aria-hidden="true">
        {argument}
      </span>
      {showTimer ? (
        <span ref={timerRef} className="relative min-w-[6ch] text-right tabular-nums opacity-50" aria-hidden="true">
          —
        </span>
      ) : null}
      {status === 'error' && onRetry ? (
        <button
          type="button"
          className="absolute -inset-[5px] m-0 cursor-pointer touch-manipulation appearance-none border-0 bg-transparent p-0 outline-none [border-radius:var(--cc-radius)] [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-[var(--cc-error)] focus-visible:ring-inset"
          aria-label={`${labels.retry}: ${name} ${argument}`}
          onClick={() => onRetry()}
          onPointerDown={() => setPressed(true)}
          onPointerUp={() => setPressed(false)}
          onPointerCancel={() => setPressed(false)}
        />
      ) : null}
      <span className="sr-only">{`${name} ${argument}: ${labels[status]}`}</span>
    </span>
  )
}

export default CallChip
