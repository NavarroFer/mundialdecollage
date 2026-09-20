'use client'

import { useMemo, useState, useTransition } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { applyNameCleanup } from '@/app/admin/obras/actions'

export type NameCleanupItem = {
  table: 'profiles' | 'legacy_submissions'
  id: string
  before: string
  after: string
}

const itemKey = (item: NameCleanupItem) => `${item.table}:${item.id}`

// Preview + approve UI for the "sanitizar mayúsculas/minúsculas" cleanup
// (see ROADMAP.md's item 5) — normalizeArtistName() is a best-effort
// title-caser, not a real name parser, so every row here is opt-out rather
// than applied silently: a stage name or a "Mc"-style surname it gets wrong
// can just be unchecked instead of forced through.
export function NameCleanup({ items }: { items: NameCleanupItem[] }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.map(itemKey)))
  const [applied, setApplied] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  const pending = useMemo(() => items.filter((item) => !applied.has(itemKey(item))), [items, applied])
  const selectedCount = pending.filter((item) => selected.has(itemKey(item))).length

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function apply() {
    const toApply = pending.filter((item) => selected.has(itemKey(item)))
    if (toApply.length === 0) return
    startTransition(async () => {
      await applyNameCleanup(toApply.map(({ table, id }) => ({ table, id })))
      setApplied((prev) => new Set([...prev, ...toApply.map(itemKey)]))
    })
  }

  if (pending.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-ink/10 bg-card px-4 py-8 text-center text-muted-foreground">
        No encontré nombres para prolijar — ya están bien formateados.
      </p>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          {pending.length} nombre{pending.length === 1 ? '' : 's'} con mayúsculas/minúsculas o
          espacios raros. Desmarcá los que ya están bien así (un alias, un apellido con
          &quot;Mc&quot;, etc.) antes de aplicar.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setSelected(new Set(pending.map(itemKey)))}
            className="text-xs font-semibold text-collage-blue hover:underline"
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs font-semibold text-muted-foreground hover:underline"
          >
            Ninguno
          </button>
        </div>
      </div>

      <div className="mt-4 divide-y divide-ink/10 rounded-2xl border-2 border-ink/10 bg-card">
        {pending.map((item) => {
          const key = itemKey(item)
          return (
            <label key={key} className="flex items-center gap-3 px-4 py-3 text-sm">
              <input
                type="checkbox"
                checked={selected.has(key)}
                onChange={() => toggle(key)}
                className="h-4 w-4 shrink-0 rounded border-2 border-ink/30"
              />
              <span className="min-w-0 flex-1 truncate text-muted-foreground line-through decoration-collage-red/60">
                {item.before}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold text-ink">{item.after}</span>
              <span className="shrink-0 rounded-full bg-ink/5 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-muted-foreground">
                {item.table === 'profiles' ? 'Registrado' : 'Precargado'}
              </span>
            </label>
          )
        })}
      </div>

      <button
        type="button"
        disabled={isPending || selectedCount === 0}
        onClick={apply}
        className="mt-4 flex items-center gap-2 rounded-full bg-collage-blue px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-collage-blue/90 disabled:opacity-50"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Aplicar a {selectedCount} seleccionado{selectedCount === 1 ? '' : 's'}
      </button>
    </div>
  )
}
