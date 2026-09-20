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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { countryCodeToFlag, countryCodeToName } from '@/lib/participants'
import { setSubmissionsVisibility } from '@/app/admin/obras/actions'

type Submission = {
  id: string
  name: string
  // Missing for a `source: 'legacy'` row — legacy_submissions only has
  // free-text country_raw (see supabase/migrations/20260919000000_legacy_
  // submissions.sql), never a real ISO code, so there's nothing to flag or
  // filter by for those.
  countryCode?: string
  technique?: string
  artworkTitle?: string
  imageUrl: string
  // Only ever set for a `source: 'legacy'` row — the site-stored imageUrl is
  // a resized copy (see lib/legacy-submissions.ts's storeLegacyArtworkGlobally),
  // so this is how an admin gets back to the original file on Drive to judge
  // it at full size.
  driveUrl?: string
  isPublic: boolean
  // How many artwork rows this artist has total (see
  // supabase/migrations/20260921040000_artworks.sql) — more than one means
  // there's a resubmission waiting to be curated in the "Artistas con varias
  // obras" section above this gallery.
  artworkCount?: number
  // 'legacy' = a confirmed supabase/migrations/20260921070000_legacy_
  // submissions_promoted.sql row, shown here alongside real registrations so
  // the admin sees everything received in one place, but it has no real
  // `profiles` row yet (the artist hasn't logged in and claimed it) — so
  // unlike a real submission it can't be select-toggled to "Participa"
  // (setSubmissionsVisibility below only ever updates `profiles`).
  source?: 'real' | 'legacy'
}

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

  // Only the countries actually represented — a full ISO-3166 dropdown would
  // be mostly empty options for a gallery of a few dozen submissions.
  // Legacy rows have no countryCode at all, so they're left out of this list
  // (filtering by country just never matches/excludes them either way).
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
    // Legacy rows are rendered disabled and can never reach `toggle()` via a
    // click, but this bypasses that button entirely — has to exclude them
    // itself, or a bulk "Estas participan"/"Ocultar" would try to update
    // `profiles` with a legacy_submissions id that table doesn't have.
    setSelected(new Set(visible.filter((s) => s.source !== 'legacy').map((s) => s.id)))
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
          {visible.map((s) => {
            const isLegacy = s.source === 'legacy'
            const isSelected = selected.has(s.id)

            const card = (
              <>
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

                  {selectMode && !isLegacy && (
                    <span className="absolute top-2 right-2 rounded-full bg-white/90 p-0.5 shadow">
                      {isSelected ? (
                        <CircleCheck className="h-6 w-6 text-collage-blue" fill="white" />
                      ) : (
                        <Circle className="h-6 w-6 text-ink/40" />
                      )}
                    </span>
                  )}

                  {isLegacy && s.driveUrl && (
                    <a
                      href={s.driveUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="Ver la foto original en Drive, en tamaño completo"
                      className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[0.65rem] font-bold text-ink shadow hover:bg-white"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Drive
                    </a>
                  )}

                  {isLegacy ? (
                    <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-ink/80 px-2 py-0.5 text-[0.65rem] font-bold text-white">
                      <CircleCheck className="h-3 w-3" />
                      Precargada
                    </span>
                  ) : (
                    s.isPublic && (
                      <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-collage-blue px-2 py-0.5 text-[0.65rem] font-bold text-primary-foreground">
                        <Megaphone className="h-3 w-3" />
                        Participa
                      </span>
                    )
                  )}
                </div>

                <p className="mt-1.5 truncate text-sm font-semibold text-ink">
                  {s.countryCode && <span aria-hidden>{countryCodeToFlag(s.countryCode)}</span>} {s.name}
                </p>
                {s.artworkTitle && <p className="truncate text-xs text-muted-foreground">{s.artworkTitle}</p>}
              </>
            )

            // A legacy row can't be select-toggled (see the Submission type's
            // `source` comment), so it's a plain non-interactive container —
            // a disabled <button> would also block clicks on the Drive <a>
            // nested inside it.
            return isLegacy ? (
              <div key={s.id} className="text-left">
                {card}
              </div>
            ) : (
              <button key={s.id} type="button" onClick={() => toggle(s.id)} className="group text-left">
                {card}
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
      )}
    </div>
  )
}
