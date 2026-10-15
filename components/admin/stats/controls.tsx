'use client'

import Link from 'next/link'
import { Loader2, type LucideIcon } from 'lucide-react'
import type { MouseEvent } from 'react'
import { cn } from '@/lib/utils'
import { useStatsNavigation } from './navigation'

// The two control shapes every chart toolbar, the page's control bar and the
// capture screen share. The selected state is ink, never a series color, so
// a control is never mistaken for data. `tone="dark"` is for the capture
// screen's ink background.
type Tone = 'light' | 'dark'

export function ToolbarToggle({
  pressed,
  onPressedChange,
  icon: Icon,
  tone = 'light',
  children,
}: {
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
  icon: LucideIcon
  tone?: Tone
  children: React.ReactNode
}) {
  return (
    <button type="button" aria-pressed={pressed} onClick={() => onPressedChange(!pressed)} className={toggleClass(pressed, tone)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {children}
    </button>
  )
}

// An action, not a state. `primary` wears the selected look to stand out.
export function ToolbarButton({ onClick, icon: Icon, tone = 'light', primary = false, disabled, children }: { onClick: () => void; icon: LucideIcon; tone?: Tone; primary?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cn(toggleClass(primary, tone), 'disabled:cursor-wait disabled:opacity-60')}>
      <Icon className="size-3.5" aria-hidden="true" />
      {children}
    </button>
  )
}

function toggleClass(pressed: boolean, tone: Tone) {
  return cn(
    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
    tone === 'light'
      ? pressed ? 'border-ink bg-ink text-paper focus-visible:outline-ink' : 'border-ink/15 bg-card text-ink hover:border-ink/45 focus-visible:outline-ink'
      : pressed ? 'border-paper bg-paper text-ink focus-visible:outline-paper' : 'border-paper/25 text-paper hover:border-paper/60 focus-visible:outline-paper',
  )
}

type Option<T> = { value: T; label: string; href?: string }

// One choice among a few. Options with an href are links (the period and the
// grouping are in the URL and re-render the page on the server): the one
// pressed reads as chosen at once and spins until the new page lands. The
// rest are buttons.
export function Segmented<T extends string | number | null>({
  label,
  options,
  value,
  onChange,
  tone = 'light',
}: {
  label: string
  options: Option<T>[]
  value: T
  onChange?: (value: T) => void
  tone?: Tone
}) {
  const navigation = useStatsNavigation()
  const loading = options.find((option) => option.href && option.href === navigation?.target)
  const chosen = loading ? loading.value : value
  const follow = (event: MouseEvent, href: string) => {
    // A new tab or window is the browser's to open.
    if (!navigation || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    if (href !== navigation.target) navigation.navigate(href)
  }
  const item = (active: boolean) => cn(
    'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-1',
    tone === 'light'
      ? active ? 'bg-ink text-paper focus-visible:outline-ink' : 'text-muted-foreground hover:text-ink focus-visible:outline-ink'
      : active ? 'bg-paper text-ink focus-visible:outline-paper' : 'text-paper/70 hover:text-paper focus-visible:outline-paper',
  )
  return (
    <div role="group" aria-label={label} className={cn('inline-flex items-center rounded-full p-1', tone === 'light' ? 'bg-muted' : 'bg-paper/10')}>
      {options.map((option) => {
        const active = option.value === chosen
        const { href } = option
        return href
          ? (
            <Link key={String(option.value)} href={href} scroll={false} onClick={(event) => follow(event, href)} aria-current={active ? 'true' : undefined} className={item(active)}>
              {option === loading && <Loader2 className="size-3 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {option.label}
            </Link>
          )
          : <button key={String(option.value)} type="button" aria-pressed={active} onClick={() => onChange?.(option.value)} className={item(active)}>{option.label}</button>
      })}
    </div>
  )
}

export const LIMIT_OPTIONS: Option<number | null>[] = [
  { value: 5, label: 'Top 5' },
  { value: 10, label: 'Top 10' },
  { value: null, label: 'Todos' },
]
