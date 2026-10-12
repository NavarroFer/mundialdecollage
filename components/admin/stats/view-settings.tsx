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

// How capture slides are laid out, kept for the whole page so a deck of
// slides comes out alike: pick 16:9 on white once, capture every chart.
export type CapturePrefs = {
  format: '16:9' | '4:3' | '1:1'
  text: 'normal' | 'grande' | 'enorme'
  background: 'paper' | 'white'
  header: boolean
  footer: boolean
}
const DEFAULT_CAPTURE: CapturePrefs = { format: '16:9', text: 'normal', background: 'paper', header: true, footer: true }

type PageView = {
  settings: ViewSettings
  revisions: Record<ViewKey, number>
  periodLabel: string
  set: <K extends ViewKey>(key: K, value: ViewSettings[K]) => void
  capture: CapturePrefs
  setCapture: (patch: Partial<CapturePrefs>) => void
}

const PageViewContext = createContext<PageView | null>(null)

export function StatsViewProvider({ periodLabel, children }: { periodLabel: string; children: ReactNode }) {
  const [state, setState] = useState({ settings: DEFAULT_VIEW, revisions: ZERO_REVISIONS })
  const [capture, setCaptureState] = useState(DEFAULT_CAPTURE)
  const set = useCallback(<K extends ViewKey>(key: K, value: ViewSettings[K]) => {
    setState((current) => ({
      settings: { ...current.settings, [key]: value },
      revisions: { ...current.revisions, [key]: current.revisions[key] + 1 },
    }))
  }, [])
  const setCapture = useCallback((patch: Partial<CapturePrefs>) => setCaptureState((current) => ({ ...current, ...patch })), [])
  const value = useMemo(() => ({ ...state, periodLabel, set, capture, setCapture }), [state, periodLabel, set, capture, setCapture])
  return <PageViewContext value={value}>{children}</PageViewContext>
}

export function usePageView() {
  return use(PageViewContext) ?? { settings: DEFAULT_VIEW, revisions: ZERO_REVISIONS, periodLabel: '', set: () => {}, capture: DEFAULT_CAPTURE, setCapture: () => {} }
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
