'use client'

import { useMemo, useState, useTransition } from 'react'
import Image from 'next/image'
import {
  Circle,
  CircleCheck,
  CircleX,
  ExternalLink,
  EyeOff,
  ImageOff,
  ListChecks,
  Loader2,
  Megaphone,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { countryCodeToFlag, countryCodeToName } from '@/lib/participants'
import { instagramHandle } from '@/lib/instagram'
import { deleteSubmissions, setSubmissionsVisibility } from '@/app/admin/obras/actions'
import { ObraViewer } from '@/components/admin/obra-viewer'
import type { Submission } from '@/components/admin/submission-types'

type Filter = 'all' | 'pending' | 'public'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'pending', label: 'Pendientes' },
  { key: 'public', label: 'Publicadas' },
]

const TECHNIQUES = ['Analógica', 'Mixta', 'Digital'] as const
type TechniqueFilter = 'all' | (typeof TECHNIQUES)[number]

export function SubmissionsGallery({ submissions }: { submissions: Submission[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [technique, setTechnique] = useState<TechniqueFilter>('all')
  const [country, setCountry] = useState<string>('all')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  // Only the countries actually represented — a full ISO-3166 dropdown would
  // be mostly empty options for a gallery of a few dozen submissions. A
  // legacy row without a guessable country (see Submission's countryCode
  // comment) just never matches/excludes here either way.
  const countries = useMemo(() => {
    const codes = new Set(submissions.map((s) => s.countryCode).filter((c): c is string => Boolean(c)))
    return [...codes].sort((a, b) => countryCodeToName(a).localeCompare(countryCodeToName(b)))
  }, [submissions])

  const visible = useMemo(() => {
    let list = submissions
    if (filter === 'pending') list = list.filter((s) => !s.isPublic)
    else if (filter === 'public') list = list.filter((s) => s.isPublic)
    if (technique !== 'all') list = list.filter((s) => s.technique === technique)
    if (country !== 'all') list = list.filter((s) => s.countryCode === country)
    return list
  }, [submissions, filter, technique, country])

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
    setActionMessage(null)
    startTransition(async () => {
      const { skipped } = await setSubmissionsVisibility(ids, isPublic)
      if (skipped.length > 0) {
        const names = skipped
          .map((legacyId) => submissions.find((s) => s.legacyId === legacyId)?.name)
          .filter(Boolean)
          .join(', ')
        // A missing país no longer causes a skip here (see setSubmissionsVisibility
        // in actions.ts) — reaching this now means the row has no image, or the
        // account provisioning itself failed.
        setActionMessage(`${skipped.length} no se pudieron publicar, faltó la imagen o falló su cuenta (${names}).`)
      }
      cancelSelection()
    })
  }

  function applyDelete() {
    const items = Array.from(selected)
      .map((id) => submissions.find((s) => s.id === id))
      .filter((s): s is Submission => Boolean(s))
      .map((s) =>
        s.source === 'legacy'
          ? { table: 'legacy_submissions' as const, id: s.legacyId! }
          : { table: 'artworks' as const, id: s.artworkId! },
      )

    if (!window.confirm(`¿Borrar ${items.length} obra${items.length === 1 ? '' : 's'}? No se puede deshacer.`)) {
      return
    }

    setActionMessage(null)
    startTransition(async () => {
      await deleteSubmissions(items)
      cancelSelection()
    })
  }

  return (
    <div className={cn(selected.size > 0 && 'pb-24')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
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
          <select
            value={technique}
            onChange={(e) => setTechnique(e.target.value as TechniqueFilter)}
            className="rounded-full border-2 border-ink/15 bg-card px-4 py-2 text-sm font-semibold text-ink"
          >
            <option value="all">Toda técnica</option>
            {TECHNIQUES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {countries.length > 1 && (
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="rounded-full border-2 border-ink/15 bg-card px-4 py-2 text-sm font-semibold text-ink"
            >
              <option value="all">Todo país</option>
              {countries.map((code) => (
                <option key={code} value={code}>
                  {countryCodeToFlag(code)} {countryCodeToName(code)}
                </option>
              ))}
            </select>
          )}
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
          {visible.map((s, i) => {
            const isLegacy = s.source === 'legacy'
            const isSelected = selected.has(s.id)

            return (
              <div key={s.id} className="group relative text-left">
                {/* Opens the detail viewer when browsing, toggles selection instead
                    once selectMode is on — a sibling of the selection checkbox and
                    Drive link below, not their ancestor, so nothing needs
                    stopPropagation. */}
                <button
                  type="button"
                  onClick={() => (selectMode ? toggle(s.id) : setViewerIndex(i))}
                  className="block w-full text-left"
                  aria-label={
                    selectMode
                      ? isSelected
                        ? `Deseleccionar ${s.name}`
                        : `Seleccionar ${s.name}`
                      : `Ver ${s.name} en detalle`
                  }
                >
                  <div
                    className={cn(
                      'relative aspect-square overflow-hidden rounded-xl border-2 bg-muted',
                      isSelected ? 'border-collage-blue' : 'border-ink/10',
                    )}
                  >
                    <Image
                      src={s.imageUrl}
                      alt={s.artworkTitle ? `${s.artworkTitle}, de ${s.name}` : s.name}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                      className={cn(
                        'object-cover transition-opacity',
                        isSelected && 'opacity-70',
                      )}
                    />

                    {isSelected && <div className="absolute inset-0 bg-collage-blue/20" aria-hidden />}

                    {!selectMode && s.artworkCount && s.artworkCount > 1 && (
                      <span className="absolute top-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[0.65rem] font-bold text-ink shadow">
                        +{s.artworkCount} obras
                      </span>
                    )}

                    {s.isPublic ? (
                      <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-collage-blue px-2 py-0.5 text-[0.65rem] font-bold text-primary-foreground">
                        <Megaphone className="h-3 w-3" />
                        Participa
                      </span>
                    ) : (
                      isLegacy && (
                        <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-ink/80 px-2 py-0.5 text-[0.65rem] font-bold text-white">
                          <CircleCheck className="h-3 w-3" />
                          Precargada
                        </span>
                      )
                    )}
                  </div>

                  <p className="mt-1.5 truncate text-sm font-semibold text-ink">
                    {s.countryCode && <span aria-hidden>{countryCodeToFlag(s.countryCode)}</span>} {s.name}
                  </p>
                  {s.artworkTitle
                    ? <p className="truncate text-xs text-muted-foreground">{s.artworkTitle}</p>
                    : s.source === 'real' && <p className="truncate text-xs text-collage-red">Sin datos (título)</p>}
                  {s.instagram && (
                    <p className="truncate text-xs text-collage-red">@{instagramHandle(s.instagram) ?? s.instagram}</p>
                  )}
                </button>

                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                  {isLegacy && s.driveUrl && (
                    <a
                      href={s.driveUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="Ver la foto original en Drive, en tamaño completo"
                      className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[0.65rem] font-bold text-ink shadow hover:bg-white"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Drive
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => toggle(s.id)}
                    aria-label={isSelected ? `Deseleccionar ${s.name}` : `Seleccionar ${s.name}`}
                    className={cn(
                      'rounded-full bg-white/90 p-0.5 shadow transition-opacity',
                      selectMode
                        ? 'opacity-100'
                        : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
                    )}
                  >
                    {isSelected ? (
                      <CircleCheck className="h-6 w-6 text-collage-blue" fill="white" />
                    ) : (
                      <Circle className="h-6 w-6 text-ink/40" />
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-ink/10 bg-card/95 backdrop-blur">
          <div className="mx-auto max-w-6xl px-5 py-4 sm:px-8">
            {actionMessage && (
              <p className="mb-3 rounded-xl border-2 border-collage-red/30 bg-collage-red/10 px-3 py-2 text-xs text-ink">
                {actionMessage}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">
                {selected.size} seleccionada{selected.size === 1 ? '' : 's'}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={applyDelete}
                  className="flex items-center gap-2 rounded-full border-2 border-ink/15 px-4 py-2 text-sm font-semibold text-collage-red hover:border-collage-red/40 hover:bg-collage-red/10 disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Borrar
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => applyVisibility(false)}
                  className="flex items-center gap-2 rounded-full border-2 border-ink/15 px-4 py-2 text-sm font-semibold text-ink hover:border-ink/30 disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}
                  Ocultar
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => applyVisibility(true)}
                  className="flex items-center gap-2 rounded-full bg-collage-blue px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-collage-blue/90 disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
                  Estas participan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ObraViewer items={visible} activeIndex={viewerIndex} onActiveIndexChange={setViewerIndex} />
    </div>
  )
}
