'use client'

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react'

// How the /admin/estadisticas charts are shown, set for the whole page from
// the control bar and per chart from its own toolbar. A chart's choice holds
// until the page-wide control for that same setting is touched again: each
// setting carries a revision, and a local choice only counts while it was
// made on the current one.
export type ViewSettings = {
  values: boolean // a number on every point of a line
  table: boolean // the data as a table
  compare: boolean // the recent window next to the period
  notes: boolean // descriptions and footnotes
  limit: number | null // ranking rows before «Otros»
  open: boolean // collapsed charts opened
}
export type ViewKey = keyof ViewSettings

const KEYS: ViewKey[] = ['values', 'table', 'compare', 'notes', 'limit', 'open']
export const DEFAULT_VIEW: ViewSettings = { values: false, table: false, compare: true, notes: true, limit: 10, open: false }
const ZERO_REVISIONS = Object.fromEntries(KEYS.map((key) => [key, 0])) as Record<ViewKey, number>

type PageView = {
  settings: ViewSettings
  revisions: Record<ViewKey, number>
  periodLabel: string
  set: <K extends ViewKey>(key: K, value: ViewSettings[K]) => void
}

const PageViewContext = createContext<PageView | null>(null)

export function StatsViewProvider({ periodLabel, children }: { periodLabel: string; children: ReactNode }) {
  const [state, setState] = useState({ settings: DEFAULT_VIEW, revisions: ZERO_REVISIONS })
  const set = useCallback(<K extends ViewKey>(key: K, value: ViewSettings[K]) => {
    setState((current) => ({
      settings: { ...current.settings, [key]: value },
      revisions: { ...current.revisions, [key]: current.revisions[key] + 1 },
    }))
  }, [])
  const value = useMemo(() => ({ ...state, periodLabel, set }), [state, periodLabel, set])
  return <PageViewContext value={value}>{children}</PageViewContext>
}

export function usePageView() {
  return use(PageViewContext) ?? { settings: DEFAULT_VIEW, revisions: ZERO_REVISIONS, periodLabel: '', set: () => {} }
}

type Local = Partial<Record<ViewKey, { value: ViewSettings[ViewKey]; revision: number }>>

// One chart's settings: the page's, except where this chart chose otherwise.
// `initial` is the chart's own starting point (e.g. a table shown by default).
export function useChartSettings(initial?: Partial<ViewSettings>) {
  const page = usePageView()
  const [local, setLocal] = useState<Local>(() =>
    Object.fromEntries(Object.entries(initial ?? {}).map(([key, value]) => [key, { value, revision: 0 }])),
  )
  const settings = Object.fromEntries(
    KEYS.map((key) => {
      const choice = local[key]
      return [key, choice && choice.revision === page.revisions[key] ? choice.value : page.settings[key]]
    }),
  ) as ViewSettings
  const set = useCallback(<K extends ViewKey>(key: K, value: ViewSettings[K]) => {
    setLocal((current) => ({ ...current, [key]: { value, revision: page.revisions[key] } }))
  }, [page.revisions])
  return [settings, set] as const
}
