'use client'

import { useMemo, useState, useTransition } from 'react'
import Image from 'next/image'
import {
  Circle,
  CircleCheck,
  CircleX,
  ChevronDown,
  ExternalLink,
  EyeOff,
  ImageOff,
  LayoutGrid,
  List,
  ListChecks,
  Loader2,
  Megaphone,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { countryCodeToFlag, countryCodeToName } from '@/lib/participants'
import { instagramHandle } from '@/lib/instagram'
import { deleteSubmissions, setSubmissionsReviewStatus, setSubmissionsTechnique, setSubmissionsVisibility } from '@/app/admin/obras/actions'
import { ObraViewer } from '@/components/admin/obra-viewer'
import type { Submission } from '@/components/admin/submission-types'

type Filter = 'all' | 'pending' | 'public'
type ViewMode = 'list' | 'mosaic'
type OriginFilter = 'all' | 'spreadsheet' | 'website'
type ReviewFilter = 'all' | Submission['reviewStatus']
type DateOrder = 'newest' | 'oldest'
// Data still to complete or curate: what's missing from an obra, or artists
// who sent more than one.
type DataFilter = 'all' | 'no_title' | 'multi'

const REVIEW_LABELS: Record<Submission['reviewStatus'], string> = {
  unreviewed: 'Sin revisar',
  preselected: 'Preseleccionada',
  rejected: 'Descartada',
}

const REVIEW_CLASSES: Record<Submission['reviewStatus'], string> = {
  unreviewed: 'bg-ink/10 text-ink',
  preselected: 'bg-collage-blue/15 text-collage-blue',
  rejected: 'bg-collage-red/10 text-collage-red',
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'pending', label: 'Pendientes' },
  { key: 'public', label: 'Publicadas' },
]

const TECHNIQUES = ['Analógica', 'Mixta', 'Digital'] as const
type TechniqueFilter = 'all' | 'none' | (typeof TECHNIQUES)[number]

export function SubmissionsGallery({ submissions }: { submissions: Submission[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [technique, setTechnique] = useState<TechniqueFilter>('all')
  const [country, setCountry] = useState<string>('all')
  const [origin, setOrigin] = useState<OriginFilter>('all')
  const [review, setReview] = useState<ReviewFilter>('all')
  const [data, setData] = useState<DataFilter>('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [dateOrder, setDateOrder] = useState<DateOrder>('newest')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const secondaryCount = [technique, country, origin, data].filter((value) => value !== 'all').length

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
    if (technique === 'none') list = list.filter((s) => !s.technique)
    else if (technique !== 'all') list = list.filter((s) => s.technique === technique)
    if (country === 'none') list = list.filter((s) => !s.countryCode)
    else if (country !== 'all') list = list.filter((s) => s.countryCode === country)
    if (data === 'no_title') list = list.filter((s) => !s.artworkTitle?.trim())
    else if (data === 'multi') list = list.filter((s) => (s.artworkCount ?? 1) > 1)
    if (origin === 'spreadsheet') list = list.filter((s) => s.source === 'legacy')
    else if (origin === 'website') list = list.filter((s) => s.source !== 'legacy')
    if (review !== 'all') list = list.filter((s) => s.reviewStatus === review)
    const searchTerm = search.trim().toLocaleLowerCase()
    if (searchTerm) {
      list = list.filter((s) =>
        [s.name, s.artworkTitle, s.email]
          .filter((value): value is string => Boolean(value))
          .some((value) => value.toLocaleLowerCase().includes(searchTerm)),
      )
    }
    return [...list].sort((a, b) => {
      const difference = Date.parse(a.createdAt ?? '') - Date.parse(b.createdAt ?? '')
      return dateOrder === 'newest' ? -difference : difference
    })
  }, [submissions, filter, technique, country, origin, review, data, search, dateOrder])

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

  function resetFilters() {
    setFilter('all')
    setTechnique('all')
    setCountry('all')
    setOrigin('all')
    setReview('all')
    setData('all')
  }

  const optionLabel = (options: { value: string; label: string }[], value: string) => options.find((o) => o.value === value)?.label ?? value
  const activeChips = [
    filter !== 'all' && { label: optionLabel(FILTERS.map((f) => ({ value: f.key, label: f.label })), filter), clear: () => setFilter('all') },
    review !== 'all' && { label: REVIEW_LABELS[review], clear: () => setReview('all') },
    technique !== 'all' && { label: technique === 'none' ? 'Sin técnica' : technique, clear: () => setTechnique('all') },
    country !== 'all' && { label: country === 'none' ? 'Sin país' : countryCodeToName(country), clear: () => setCountry('all') },
    origin !== 'all' && { label: origin === 'spreadsheet' ? 'Desde planilla' : 'Desde la página', clear: () => setOrigin('all') },
    data !== 'all' && { label: data === 'no_title' ? 'Sin título' : 'Varias obras', clear: () => setData('all') },
  ].filter((chip): chip is { label: string; clear: () => void } => Boolean(chip))

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

  function applyReviewStatus(reviewStatus: Submission['reviewStatus']) {
    const ids = Array.from(selected)
    setActionMessage(null)
    startTransition(async () => {
      await setSubmissionsReviewStatus(ids, reviewStatus)
      cancelSelection()
    })
  }

  function applyTechnique(value: string) {
    const ids = Array.from(selected)
    setActionMessage(null)
    startTransition(async () => {
      await setSubmissionsTechnique(ids, value === 'none' ? null : value)
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
    <div className={cn(selected.size > 0 && 'pb-[23rem] sm:pb-[20rem] lg:pb-52')}>
      <section className="rounded-2xl border-2 border-ink/10 bg-card">
        {/* 1 · Find and arrange: always at hand. */}
        <div className="flex flex-wrap items-center gap-2 p-3 sm:p-4">
          <label className="flex min-w-56 flex-1 items-center gap-2 rounded-full border-2 border-ink/15 bg-background px-4 py-2 text-sm text-ink focus-within:border-ink/40">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="sr-only">Buscar obras</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar artista, título o email"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </label>
          <select value={dateOrder} onChange={(event) => setDateOrder(event.target.value as DateOrder)} aria-label="Orden" className="rounded-full border-2 border-ink/15 bg-background px-4 py-2 text-sm font-semibold text-ink">
            <option value="newest">Más recientes primero</option>
            <option value="oldest">Más antiguas primero</option>
          </select>
          <div className="flex rounded-full border-2 border-ink/15 bg-card p-0.5" aria-label="Vista de obras">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={cn('rounded-full p-2', viewMode === 'list' ? 'bg-collage-blue text-primary-foreground' : 'text-muted-foreground hover:text-ink')}
              aria-label="Ver como lista"
              title="Vista de lista"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('mosaic')}
              className={cn('rounded-full p-2', viewMode === 'mosaic' ? 'bg-collage-blue text-primary-foreground' : 'text-muted-foreground hover:text-ink')}
              aria-label="Ver como mosaico"
              title="Vista de mosaico"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
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

        {/* 2 · The day-to-day curation filters. */}
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-t-2 border-ink/10 px-3 py-3 sm:px-4">
          <Segmented label="Publicación" value={filter} onChange={setFilter} options={FILTERS.map((f) => ({ value: f.key, label: f.label }))} />
          <Segmented
            label="Revisión"
            value={review}
            onChange={setReview}
            options={[
              { value: 'all', label: 'Todas' },
              { value: 'unreviewed', label: 'Sin revisar' },
              { value: 'preselected', label: 'Preseleccionadas' },
              { value: 'rejected', label: 'Descartadas' },
            ]}
          />
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            aria-controls="obra-filters"
            className="ml-auto flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-ink hover:bg-ink/5"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Más filtros
            {secondaryCount > 0 && <span className="rounded-full bg-collage-blue px-2 py-0.5 text-[0.65rem] text-primary-foreground">{secondaryCount}</span>}
            <ChevronDown className={cn('h-4 w-4 transition-transform', filtersOpen && 'rotate-180')} />
          </button>
        </div>

        {/* 3 · Details: what the obra is and what's missing from it. */}
        {filtersOpen && (
          <div id="obra-filters" className="grid gap-3 border-t-2 border-ink/10 bg-ink/[0.02] px-3 py-3 sm:grid-cols-2 sm:px-4 lg:grid-cols-4">
            <FilterSelect label="Técnica" value={technique} onChange={(v) => setTechnique(v as TechniqueFilter)}>
              <option value="all">Todas</option>
              {TECHNIQUES.map((t) => <option key={t} value={t}>{t}</option>)}
              <option value="none">Sin técnica</option>
            </FilterSelect>
            <FilterSelect label="País" value={country} onChange={setCountry}>
              <option value="all">Todos</option>
              {countries.map((code) => <option key={code} value={code}>{countryCodeToFlag(code)} {countryCodeToName(code)}</option>)}
              <option value="none">Sin país</option>
            </FilterSelect>
            <FilterSelect label="Origen" value={origin} onChange={(v) => setOrigin(v as OriginFilter)}>
              <option value="all">Todos</option>
              <option value="spreadsheet">Importadas desde planilla</option>
              <option value="website">Registradas en la página</option>
            </FilterSelect>
            <FilterSelect label="Datos" value={data} onChange={(v) => setData(v as DataFilter)}>
              <option value="all">Todas</option>
              <option value="no_title">Sin título</option>
              <option value="multi">Artistas con varias obras</option>
            </FilterSelect>
          </div>
        )}

        {/* 4 · What's showing, and each active filter one tap from gone. */}
        <div className="flex flex-wrap items-center gap-2 border-t-2 border-ink/10 px-3 py-2.5 text-sm sm:px-4">
          <p className="font-semibold text-ink">
            {visible.length === submissions.length ? `${submissions.length} obras` : `${visible.length} de ${submissions.length} obras`}
          </p>
          {activeChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={chip.clear}
              className="flex items-center gap-1 rounded-full bg-collage-blue/10 px-2.5 py-1 text-xs font-semibold text-collage-blue hover:bg-collage-blue/20"
              aria-label={`Quitar filtro ${chip.label}`}
            >
              {chip.label}
              <X className="h-3 w-3" aria-hidden />
            </button>
          ))}
          {activeChips.length > 1 && (
            <button type="button" onClick={resetFilters} className="text-xs font-semibold text-muted-foreground hover:text-ink hover:underline">
              Limpiar todo
            </button>
          )}
        </div>
      </section>

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
        <div className={cn(
          'mt-6',
          viewMode === 'list'
            ? 'space-y-2'
            : 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
        )}>
          {visible.map((s, i) => {
            const isLegacy = s.source === 'legacy'
            const isSelected = selected.has(s.id)

            return (
              <div
                key={s.id}
                className={cn(
                  'group relative text-left',
                  viewMode === 'list' && 'rounded-xl border-2 border-ink/10 bg-card transition-colors hover:border-ink/25',
                )}
              >
                {/* Opens the detail viewer when browsing, toggles selection instead
                    once selectMode is on — a sibling of the selection checkbox and
                    Drive link below, not their ancestor, so nothing needs
                    stopPropagation. */}
                <button
                  type="button"
                  onClick={() => (selectMode ? toggle(s.id) : setViewerIndex(i))}
                  className={cn(
                    'text-left',
                    viewMode === 'list' ? 'flex w-full min-w-0 items-center gap-4 p-3 pr-14 sm:pr-28' : 'block w-full',
                  )}
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
                      'relative overflow-hidden rounded-xl border-2 bg-muted',
                      viewMode === 'list' ? 'h-24 w-24 shrink-0 sm:h-28 sm:w-28' : 'aspect-square',
                      isSelected ? 'border-collage-blue' : 'border-ink/10',
                    )}
                  >
                    <Image
                      src={s.imageUrl}
                      alt={s.artworkTitle ? `${s.artworkTitle}, de ${s.name}` : s.name}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                      className={cn(
                        'object-contain p-1 transition-opacity',
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

                  <div className={cn('min-w-0', viewMode === 'mosaic' && 'mt-1.5')}>
                    <p className="truncate text-sm font-semibold text-ink">
                      {s.artworkTitle ?? 'Sin título'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.countryCode && <span aria-hidden>{countryCodeToFlag(s.countryCode)} </span>}{s.name}
                      {s.technique && ` · ${s.technique}`}
                    </p>
                    <p className="mt-1 text-[0.65rem] font-bold tracking-wide text-muted-foreground uppercase">
                      Origen: {s.source === 'legacy' ? 'Importada desde planilla' : 'Registrada en la página'}
                    </p>
                    <span className={cn('mt-1 inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-bold', REVIEW_CLASSES[s.reviewStatus])}>
                      {REVIEW_LABELS[s.reviewStatus]}
                    </span>
                    {!s.artworkTitle && s.source === 'real' && <p className="truncate text-xs text-collage-red">Sin datos (título)</p>}
                    {s.instagram && (
                      <p className="truncate text-xs text-collage-red">@{instagramHandle(s.instagram) ?? s.instagram}</p>
                    )}
                  </div>
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
        <div className="fixed inset-x-0 bottom-0 z-20 max-h-[70svh] overflow-y-auto border-t-2 border-ink/10 bg-card/95 shadow-[0_-12px_30px_rgb(35_30_27_/_0.10)] backdrop-blur">
          <div className="mx-auto max-w-6xl px-5 py-3 sm:px-8 sm:py-4">
            {actionMessage && (
              <p className="mb-3 rounded-xl border-2 border-collage-red/30 bg-collage-red/10 px-3 py-2 text-xs text-ink">
                {actionMessage}
              </p>
            )}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-ink">
                  {selected.size} obra{selected.size === 1 ? '' : 's'} seleccionada{selected.size === 1 ? '' : 's'}
                </p>
                <p className="text-xs text-muted-foreground">Elegí una acción para todas las seleccionadas.</p>
              </div>
              <button
                type="button"
                onClick={cancelSelection}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-ink/5 hover:text-ink focus-visible:ring-2 focus-visible:ring-ink/50 focus-visible:outline-none"
              >
                <X className="h-3.5 w-3.5" />
                Cancelar
              </button>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.65fr_1fr]">
              <fieldset className="rounded-xl border border-ink/10 bg-background/70 p-2.5">
                <legend className="px-1 text-[0.65rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">Técnica</legend>
                <select
                  value=""
                  disabled={isPending}
                  onChange={(event) => event.target.value && applyTechnique(event.target.value)}
                  aria-label="Asignar técnica a las seleccionadas"
                  className="h-10 w-full rounded-lg border border-ink/15 bg-card px-3 text-sm font-semibold text-ink transition-colors hover:border-ink/30 focus:border-ink/40 focus:outline-none disabled:opacity-50"
                >
                  <option value="">Asignar técnica…</option>
                  {TECHNIQUES.map((t) => <option key={t} value={t}>{t}</option>)}
                  <option value="none">Quitar técnica</option>
                </select>
              </fieldset>

              <fieldset className="rounded-xl border border-ink/10 bg-background/70 p-2.5 sm:col-span-2 lg:col-span-1">
                <legend className="px-1 text-[0.65rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">Revisión</legend>
                <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => applyReviewStatus('unreviewed')}
                  className="h-10 rounded-lg border border-ink/15 bg-card px-2 text-xs font-semibold text-ink transition-colors hover:border-ink/30 hover:bg-ink/5 focus-visible:ring-2 focus-visible:ring-ink/50 focus-visible:outline-none disabled:opacity-50"
                >
                  Sin revisar
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => applyReviewStatus('preselected')}
                  className="h-10 rounded-lg border border-collage-blue/30 bg-collage-blue/5 px-2 text-xs font-semibold text-collage-blue transition-colors hover:bg-collage-blue/15 focus-visible:ring-2 focus-visible:ring-collage-blue/50 focus-visible:outline-none disabled:opacity-50"
                >
                  Preseleccionar
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => applyReviewStatus('rejected')}
                  className="h-10 rounded-lg border border-collage-red/25 bg-collage-red/5 px-2 text-xs font-semibold text-collage-red transition-colors hover:bg-collage-red/15 focus-visible:ring-2 focus-visible:ring-collage-red/50 focus-visible:outline-none disabled:opacity-50"
                >
                  Descartar
                </button>
                </div>
              </fieldset>

              <fieldset className="rounded-xl border border-ink/10 bg-background/70 p-2.5">
                <legend className="px-1 text-[0.65rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">Publicación</legend>
                <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => applyVisibility(true)}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-collage-blue px-2 text-xs font-bold text-primary-foreground shadow-sm transition-colors hover:bg-collage-blue/90 focus-visible:ring-2 focus-visible:ring-collage-blue/50 focus-visible:outline-none disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
                  Publicar
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => applyVisibility(false)}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-ink/15 bg-card px-2 text-xs font-semibold text-ink transition-colors hover:border-ink/30 hover:bg-ink/5 focus-visible:ring-2 focus-visible:ring-ink/50 focus-visible:outline-none disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}
                  Ocultar
                </button>
                </div>
              </fieldset>

              <button
                type="button"
                disabled={isPending}
                onClick={applyDelete}
                className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-collage-red/25 bg-collage-red/[0.03] px-3 text-xs font-semibold text-collage-red transition-colors hover:border-collage-red/45 hover:bg-collage-red/10 focus-visible:ring-2 focus-visible:ring-collage-red/50 focus-visible:outline-none disabled:opacity-50 sm:col-span-2 lg:col-span-3"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Borrar definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      <ObraViewer items={visible} activeIndex={viewerIndex} onActiveIndexChange={setViewerIndex} />
    </div>
  )
}

// A row of mutually exclusive choices with a small label on top: the
// filters used every day, one tap each.
function Segmented<T extends string>({ label, value, onChange, options }: {
  label: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-1 text-[0.65rem] font-bold tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
      <div className="flex flex-wrap rounded-full border-2 border-ink/10 bg-background p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-semibold transition-colors',
              value === option.value ? 'bg-collage-blue text-primary-foreground' : 'text-muted-foreground hover:text-ink',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// A labeled select; highlighted while it filters something.
function FilterSelect({ label, value, onChange, children }: {
  label: string
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[0.65rem] font-bold tracking-[0.14em] text-muted-foreground uppercase">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'w-full rounded-lg border-2 bg-background px-3 py-2 text-sm font-semibold text-ink',
          value === 'all' ? 'border-ink/15' : 'border-collage-blue',
        )}
      >
        {children}
      </select>
    </label>
  )
}
