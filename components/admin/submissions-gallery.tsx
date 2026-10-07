'use client'

import { useMemo, useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import {
  Circle,
  CircleCheck,
  CircleX,
  ChevronDown,
  EyeOff,
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
import { deleteSubmissions, setSubmissionsReviewStatus, setSubmissionsTechnique, setSubmissionsVisibility } from '@/app/[locale]/(site)/admin/obras/actions'
import { hasSubmissionSearch, matchesSubmissionSearch } from '@/lib/admin-artwork-controls'

const SubmissionViewerLoader = dynamic(() => import('./submission-viewer-loader').then(module => module.SubmissionViewerLoader))
import type { Submission, SubmissionSearchEntry } from '@/components/admin/submission-types'

type Filter = 'all' | 'pending' | 'public'
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
  { key: 'pending', label: 'Sin publicar' },
  { key: 'public', label: 'Publicadas' },
]

const TECHNIQUES = ['Analógica', 'Mixta', 'Digital'] as const
type TechniqueFilter = 'all' | 'none' | (typeof TECHNIQUES)[number]

export function SubmissionsGallery({ submissions }: { submissions: SubmissionSearchEntry[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [technique, setTechnique] = useState<TechniqueFilter>('all')
  const [country, setCountry] = useState<string>('all')
  const [origin, setOrigin] = useState<OriginFilter>('all')
  const [review, setReview] = useState<ReviewFilter>('all')
  const [data, setData] = useState<DataFilter>('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [dateOrder, setDateOrder] = useState<DateOrder>('newest')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [openedId, setOpenedId] = useState<string | null>(null)
  const [pagination, setPagination] = useState({ key: '', page: 0 })
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

  const searching = hasSubmissionSearch(search, [filter, technique, country, origin, review, data])
  const visible = useMemo(() => {
    if (!searching) return []
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
    if (search.trim()) list = list.filter(entry => matchesSubmissionSearch(entry, search))
    return [...list].sort((a, b) => {
      const difference = Date.parse(a.createdAt ?? '') - Date.parse(b.createdAt ?? '')
      return dateOrder === 'newest' ? -difference : difference
    })
  }, [submissions, filter, technique, country, origin, review, data, search, dateOrder, searching])

  const resultKey = JSON.stringify([search, filter, technique, country, origin, review, data, dateOrder])
  const pageCount = Math.ceil(visible.length / 25)
  const page = pagination.key === resultKey ? Math.min(pagination.page, Math.max(0, pageCount - 1)) : 0
  const pageResults = visible.slice(page * 25, (page + 1) * 25)

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
    setSelected(new Set(pageResults.map((s) => s.id)))
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

  function runBulkAction(action: () => Promise<void>) {
    setActionMessage(null)
    startTransition(async () => {
      try {
        await action()
      } catch (error) {
        setActionMessage(error instanceof Error ? error.message : 'No se pudo completar la acción. Volvé a intentar.')
      }
    })
  }

  function applyVisibility(isPublic: boolean) {
    const ids = Array.from(selected)
    runBulkAction(async () => {
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
    runBulkAction(async () => {
      await setSubmissionsReviewStatus(ids, reviewStatus)
      cancelSelection()
    })
  }

  function applyTechnique(value: string) {
    const ids = Array.from(selected)
    runBulkAction(async () => {
      await setSubmissionsTechnique(ids, value === 'none' ? null : value)
      cancelSelection()
    })
  }

  function applyDelete() {
    const items = Array.from(selected)
      .map((id) => submissions.find((s) => s.id === id))
      .filter((s): s is SubmissionSearchEntry => Boolean(s))
      .map((s) =>
        s.source === 'legacy'
          ? { table: 'legacy_submissions' as const, id: s.legacyId! }
          : { table: 'artworks' as const, id: s.artworkId! },
      )

    if (!window.confirm(`¿Borrar ${items.length} obra${items.length === 1 ? '' : 's'}? No se puede deshacer.`)) {
      return
    }

    runBulkAction(async () => {
      await deleteSubmissions(items)
      cancelSelection()
    })
  }

  return (
    <div className={cn(selected.size > 0 && 'pb-[23rem] sm:pb-[20rem] lg:pb-52')}>
      {actionMessage && <p role="alert" className="mb-3 rounded-xl border-2 border-collage-red/30 bg-collage-red/10 px-3 py-2 text-sm text-ink">{actionMessage}</p>}
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
            {searching ? `${visible.length} resultados de ${submissions.length} obras` : `${submissions.length} obras disponibles para buscar`}
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

      {selectMode && pageResults.length > 0 && (
        <button
          type="button"
          onClick={selectAllVisible}
          className="mt-3 text-sm font-semibold text-collage-blue hover:underline"
        >
          Seleccionar los {pageResults.length} resultados de esta página
        </button>
      )}


      {!searching ? (
        <p className="mt-6 rounded-xl border-2 border-dashed border-ink/15 px-4 py-6 text-center text-sm text-muted-foreground">
          Escribí al menos dos caracteres o elegí un filtro para buscar. Seleccioná un resultado para ver su imagen y revisarlo.
        </p>
      ) : visible.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground" role="status">No hay obras que coincidan con tu búsqueda.</p>
      ) : (
        <div className="mt-4 space-y-2" aria-label="Resultados de obras">
          {pageResults.map(submission => (
            <div key={submission.id} className="flex items-center gap-3 rounded-xl border-2 border-ink/10 bg-card p-3 hover:border-ink/25">
              <button type="button" onClick={() => selectMode ? toggle(submission.id) : setOpenedId(submission.id)} className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-collage-blue">
                <p className="truncate text-sm font-semibold text-ink">{submission.artworkTitle?.trim() || 'Sin título'}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {submission.countryCode && <span aria-hidden>{countryCodeToFlag(submission.countryCode)} </span>}{submission.name}
                  {submission.technique && ` · ${submission.technique}`}
                </p>
                {submission.email && <p className="truncate text-xs text-muted-foreground">{submission.email}</p>}
                <span className={cn('mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold', REVIEW_CLASSES[submission.reviewStatus])}>{REVIEW_LABELS[submission.reviewStatus]}</span>
                {submission.isPublic && <span className="ml-2 text-xs text-collage-blue">Publicada</span>}
                {(submission.artworkCount ?? 1) > 1 && <span className="ml-2 text-xs text-muted-foreground">{submission.artworkCount} obras del artista</span>}
                {submission.instagram && <p className="truncate text-xs text-collage-red">@{instagramHandle(submission.instagram) ?? submission.instagram}</p>}
              </button>
              <button type="button" onClick={() => toggle(submission.id)} aria-label={`${selected.has(submission.id) ? 'Deseleccionar' : 'Seleccionar'} ${submission.artworkTitle?.trim() || 'obra sin título'} de ${submission.name}`} aria-pressed={selected.has(submission.id)} className="rounded-full p-1 text-collage-blue focus-visible:outline-2 focus-visible:outline-collage-blue">
                {selected.has(submission.id) ? <CircleCheck className="h-6 w-6" /> : <Circle className="h-6 w-6 text-ink/40" />}
              </button>
            </div>
          ))}
          {pageCount > 1 && (
            <nav className="flex items-center justify-between pt-3 text-sm" aria-label="Páginas de resultados">
              <button type="button" disabled={page === 0} onClick={() => setPagination({ key: resultKey, page: page - 1 })} className="rounded-lg border border-ink/15 px-3 py-2 disabled:opacity-40">Anterior</button>
              <span>Página {page + 1} de {pageCount}</span>
              <button type="button" disabled={page + 1 >= pageCount} onClick={() => setPagination({ key: resultKey, page: page + 1 })} className="rounded-lg border border-ink/15 px-3 py-2 disabled:opacity-40">Siguiente</button>
            </nav>
          )}
        </div>
      )}

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 max-h-[70svh] overflow-y-auto border-t-2 border-ink/10 bg-card/95 shadow-[0_-12px_30px_rgb(35_30_27_/_0.10)] backdrop-blur">
          <div className="mx-auto max-w-6xl px-5 py-3 sm:px-8 sm:py-4">
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

      {openedId && <SubmissionViewerLoader key={openedId} id={openedId} revision={submissions} onClose={() => setOpenedId(null)} />}
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
