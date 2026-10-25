'use client'
import { useEffect } from 'react'
import { useI18n } from '@/lib/i18n/client'
import { graphicsLabels } from './labels'
import { LEVELS, type Selection } from './quality'
import { useGraphics } from './store'

export function GraphicsSettings() {
  const { locale } = useI18n()
  const state = useGraphics()
  useEffect(() => { useGraphics.getState().hydrate() }, [])
  const t = graphicsLabels[locale]
  const names = t.names
  return <fieldset className="space-y-2 border-t border-current/20 pt-3">
    <legend className="px-1 font-bold">{t.title}</legend>
    <label className="flex flex-wrap items-center justify-between gap-2">
      {t.detail}
      <select className="min-h-11 rounded border border-current bg-paper p-2 text-ink" value={state.selection} onChange={(e) => state.configure(e.target.value as Selection, state.adaptive)}>
        <option value="auto">{t.auto}</option>
        {LEVELS.map((level, i) => <option key={level} value={level}>{names[i]}</option>)}
      </select>
    </label>
    <label className="flex min-h-11 items-center gap-2">
      <input type="checkbox" checked={state.adaptive} onChange={(e) => state.configure(state.selection, e.target.checked)} />
      {t.adapt}
    </label>
    <p className="text-xs opacity-75">{t.current}: {names[LEVELS.indexOf(state.current)]}{state.fps !== null ? ` · ${state.fps} FPS` : ''}</p>
    <p className="text-xs opacity-75">{t.help}</p>
  </fieldset>
}
