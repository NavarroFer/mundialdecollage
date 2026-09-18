'use client'

import { useMemo, useState, useTransition } from 'react'
import { Circle, CircleCheck, CircleX, EyeOff, ImageOff, ListChecks, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { countryCodeToFlag } from '@/lib/participants'
import { setSubmissionsVisibility } from '@/app/admin/obras/actions'

type Submission = {
  id: string
  name: string
  countryCode: string
  technique?: string
  artworkTitle: string
  imageUrl: string
  isPublic: boolean
}

type Filter = 'all' | 'pending' | 'public'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'pending', label: 'Pendientes' },
  { key: 'public', label: 'Publicadas' },
]

export function SubmissionsGallery({ submissions }: { submissions: Submission[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  const visible = useMemo(() => {
    if (filter === 'pending') return submissions.filter((s) => !s.isPublic)
    if (filter === 'public') return submissions.filter((s) => s.isPublic)
    return submissions
  }, [submissions, filter])

  function toggle(id: string) {
    if (!selectMode) {
      setSelectMode(true)
      setSelected(new Set([id]))
      return
    }
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function cancelSelection() {
    setSelectMode(false)
    setSelected(new Set())
  }

  function selectAllVisible() {
    setSelected(new Set(visible.map((s) => s.id)))
  }

  function applyVisibility(isPublic: boolean) {
    const ids = Array.from(selected)
    startTransition(async () => {
      await setSubmissionsVisibility(ids, isPublic)
      cancelSelection()
    })
  }

  return (
    <div className={cn(selected.size > 0 && 'pb-24')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                filter === f.key
                  ? 'bg-collage-blue text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:text-ink',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => (selectMode ? cancelSelection() : setSelectMode(true))}
          className="flex items-center gap-2 rounded-full border-2 border-ink/15 px-4 py-2 text-sm font-semibold text-ink hover:border-ink/30"
        >
          {selectMode ? <CircleX className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />}
          {selectMode ? 'Cancelar' : 'Seleccionar'}
        </button>
      </div>

      {selectMode && (
        <button
          type="button"
          onClick={selectAllVisible}
          className="mt-3 text-sm font-semibold text-collage-blue hover:underline"
        >
          Seleccionar las {visible.length} visibles
        </button>
      )}

      {submissions.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-2 text-center text-muted-foreground">
          <ImageOff className="h-8 w-8" />
          <p>Todavía no llegó ninguna obra.</p>
        </div>
      ) : visible.length === 0 ? (
        <p className="mt-10 text-center text-muted-foreground">No hay obras en esta categoría.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {visible.map((s) => {
            const isSelected = selected.has(s.id)
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                className="group text-left"
              >
                <div
                  className={cn(
                    'relative aspect-square overflow-hidden rounded-xl border-2 bg-muted',
                    isSelected ? 'border-collage-blue' : 'border-ink/10',
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.imageUrl}
                    alt={`${s.artworkTitle}, de ${s.name}`}
                    className={cn(
                      'h-full w-full object-cover transition-opacity',
                      isSelected && 'opacity-70',
                    )}
                  />

                  {isSelected && <div className="absolute inset-0 bg-collage-blue/20" aria-hidden />}

                  {selectMode && (
                    <span className="absolute top-2 right-2 rounded-full bg-white/90 p-0.5 shadow">
                      {isSelected ? (
                        <CircleCheck className="h-6 w-6 text-collage-blue" fill="white" />
                      ) : (
                        <Circle className="h-6 w-6 text-ink/40" />
                      )}
                    </span>
                  )}

                  {s.isPublic && (
                    <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-collage-blue px-2 py-0.5 text-[0.65rem] font-bold text-primary-foreground">
                      <Megaphone className="h-3 w-3" />
                      Participa
                    </span>
                  )}
                </div>

                <p className="mt-1.5 truncate text-sm font-semibold text-ink">
                  <span aria-hidden>{countryCodeToFlag(s.countryCode)}</span> {s.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">{s.artworkTitle}</p>
              </button>
            )
          })}
        </div>
      )}

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-ink/10 bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
            <p className="text-sm font-semibold text-ink">
              {selected.size} seleccionada{selected.size === 1 ? '' : 's'}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => applyVisibility(false)}
                className="flex items-center gap-2 rounded-full border-2 border-ink/15 px-4 py-2 text-sm font-semibold text-ink hover:border-ink/30 disabled:opacity-50"
              >
                <EyeOff className="h-4 w-4" />
                Ocultar
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => applyVisibility(true)}
                className="flex items-center gap-2 rounded-full bg-collage-blue px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-collage-blue/90 disabled:opacity-50"
              >
                <Megaphone className="h-4 w-4" />
                Estas participan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
