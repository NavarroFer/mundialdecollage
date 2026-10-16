'use client'

import { useRouter } from 'next/navigation'
import { createContext, use, useCallback, useMemo, useOptimistic, useTransition, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

// The filters that live in the URL (period, browser, grouping) re-render
// the page on the server, which takes a moment. Each one navigates through
// here, inside a transition (the pattern in Next's interactive-apps guide):
// the old page stays up, the option pressed reads as chosen right away
// (`target`, an optimistic value that clears when the new page lands) and
// everything that shows data dims until then.
type StatsNavigation = {
  pending: boolean
  target: string | null
  navigate: (href: string) => void
}

const StatsNavigationContext = createContext<StatsNavigation | null>(null)

export function StatsNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [target, setTarget] = useOptimistic<string | null>(null)
  const navigate = useCallback((href: string) => {
    startTransition(() => {
      setTarget(href)
      // The open tab rides in the hash (stats-tabs.tsx); a filter keeps it.
      router.push(href + window.location.hash, { scroll: false })
    })
  }, [router, setTarget])
  const value = useMemo(() => ({ pending, target, navigate }), [pending, target, navigate])
  return <StatsNavigationContext value={value}>{children}</StatsNavigationContext>
}

// Null outside the provider: a link then navigates the plain way.
export function useStatsNavigation() {
  return use(StatsNavigationContext)
}

// The charts under the control bar: dimmed and marked busy while a filter
// loads, so the numbers on screen never pass for the new ones.
export function StatsBusyArea({ children }: { children: ReactNode }) {
  const pending = useStatsNavigation()?.pending ?? false
  return (
    <div
      aria-busy={pending}
      className={cn(
        'transition-[opacity,filter] duration-300 motion-reduce:transition-none',
        pending && 'cursor-progress opacity-45 grayscale-[35%]',
      )}
    >
      {children}
    </div>
  )
}
