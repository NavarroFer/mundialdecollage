'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Check, ChevronLeft, ChevronRight, ExternalLink, List, Loader2 } from 'lucide-react'
import { saveScore } from './actions'
import { cn } from '@/lib/utils'

// Only what a juror may see: no artist, no country.
export type FocusItem = { key: string; number: number; imageUrl: string; title: string | null; technique: string | null }

type Status =
  | { kind: 'idle' }
  | { kind: 'saving'; number: number }
  | { kind: 'saved'; number: number }
  | { kind: 'error'; number: number; message: string }

const SCORES = Array.from({ length: 10 }, (_, i) => i + 1)

// «Una obra por vez»: the juror's pool (already in their order) one obra at a
// time, scored by tap or keyboard (1–9, 0 = 10, ← →). A first score saves and
// jumps to the next obra still unscored; re-scoring one stays put, so a
// review doesn't get yanked around.
export function FocusView({ items, initialScores, initialComments, closed = false }: {
  items: FocusItem[]
  initialScores: Record<string, number>
  initialComments: Record<string, string>
  // Past site.jury.deadlineISO: scores stay visible, nothing can be changed.
  closed?: boolean
}) {
  const [scores, setScores] = useState(initialScores)
  const [comments, setComments] = useState(initialComments)
  const [index, setIndex] = useState(() => Math.max(0, items.findIndex((item) => !(item.key in initialScores))))
  const [done, setDone] = useState(() => items.every((item) => item.key in initialScores))
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  // Read after the save resolves: only auto-advance if the juror is still on
  // the obra they scored.
  const indexRef = useRef(index)
  useEffect(() => { indexRef.current = index }, [index])

  const item = items[index]
  const score = item ? scores[item.key] : undefined
  const scoredCount = items.filter((it) => it.key in scores).length
  const saving = status.kind === 'saving'

  // The next obra the juror is likely to open, fetched ahead so it's instant.
  useEffect(() => {
    const next = items[index + 1]
    if (next) new window.Image().src = next.imageUrl
  }, [items, index])

  function goTo(i: number) {
    setDone(false)
    setIndex(Math.min(items.length - 1, Math.max(0, i)))
  }

  async function save(target: FocusItem, value: number, { advance }: { advance: boolean }) {
    const previous = scores[target.key]
    const firstScore = previous === undefined
    // Optimistic, so the button lights up on the tap; rolled back on error.
    const nextScores = { ...scores, [target.key]: value }
    setScores(nextScores)
    setStatus({ kind: 'saving', number: target.number })
    const formData = new FormData()
    formData.set('score', String(value))
    formData.set('comment', comments[target.key] ?? '')
    let result
    try {
      result = await saveScore(target.key, { saved: false, error: null }, formData)
    } catch {
      result = { saved: false, error: 'No se pudo guardar. Revisá la conexión y probá de nuevo.' }
    }
    if (!result.saved) {
      setScores((current) => {
        const rolledBack = { ...current }
        if (previous === undefined) delete rolledBack[target.key]
        else rolledBack[target.key] = previous
        return rolledBack
      })
      setStatus({ kind: 'error', number: target.number, message: result.error ?? 'No se pudo guardar.' })
      return
    }
    setStatus({ kind: 'saved', number: target.number })
    const at = items.indexOf(target)
    if (!advance || !firstScore || indexRef.current !== at) return
    // Next unscored in the juror's order, wrapping around to the ones skipped.
    const rest = [...items.slice(at + 1), ...items.slice(0, at)]
    const next = rest.find((it) => !(it.key in nextScores))
    if (next) setIndex(items.indexOf(next))
    else setDone(true)
  }

  function pickScore(value: number) {
    if (!item || saving || closed) return
    void save(item, value, { advance: true })
  }

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const target = event.target as HTMLElement | null
    // Typing a comment (or anything else) must never score or navigate.
    if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
    if (done) return
    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault()
      pickScore(event.key === '0' ? 10 : Number(event.key))
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      goTo(index + 1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      goTo(index - 1)
    }
  })
  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="mt-6">
      <div className="sticky top-0 z-10 -mx-5 flex flex-wrap items-center justify-between gap-3 border-y-2 border-ink/10 bg-background/95 px-5 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border-2">
        <div className="min-w-48 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <p className="font-semibold text-ink">Puntuaste {scoredCount} de {items.length}</p>
            {/* In the sticky bar so it's seen while scoring, and naming the
                obra: after an auto-advance the one on screen is the next. */}
            <div role="status" aria-live="polite">
              {status.kind === 'saving' && <span className="flex items-center gap-1.5 text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden />Guardando #{status.number}…</span>}
              {status.kind === 'saved' && <span className="flex items-center gap-1.5 font-semibold text-collage-blue"><Check className="size-4" aria-hidden />#{status.number} guardada</span>}
            </div>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-label="Obras puntuadas" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={scoredCount}>
            <div className="h-full rounded-full bg-collage-blue transition-[width]" style={{ width: `${items.length ? (scoredCount / items.length) * 100 : 0}%` }} />
          </div>
          <div role="alert">
            {status.kind === 'error' && <p className="mt-1.5 text-sm text-collage-red">#{status.number}: {status.message}</p>}
          </div>
        </div>
        <Link href="/jurado?vista=lista" className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink/15 px-4 py-2 text-sm font-semibold text-ink hover:border-ink/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue">
          <List className="size-4" aria-hidden />Ver como lista
        </Link>
      </div>

      {done || !item ? (
        <div className="mt-4 rounded-2xl border-2 border-ink/10 bg-card p-8 text-center">
          <p className="font-display text-3xl tracking-tight text-collage-blue uppercase">¡Ya puntuaste todas!</p>
          <p className="mt-2 text-muted-foreground">Gracias. Podés volver a cualquiera y cambiarle el puntaje o el comentario.</p>
          <button type="button" onClick={() => goTo(0)} className="mt-6 inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue">
            Revisar mis puntajes
          </button>
        </div>
      ) : (
        <FocusCard
          key={item.key}
          item={item}
          position={index + 1}
          total={items.length}
          score={score}
          comment={comments[item.key] ?? ''}
          saving={saving}
          onScore={pickScore}
          onComment={(value) => setComments((current) => ({ ...current, [item.key]: value }))}
          onSaveComment={() => { if (score !== undefined && !saving) void save(item, score, { advance: false }) }}
          onPrev={index > 0 ? () => goTo(index - 1) : undefined}
          onNext={index < items.length - 1 ? () => goTo(index + 1) : undefined}
        />
      )}

      <nav aria-label="Ir a una obra" className="mt-6">
        <p className="mb-2 text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">Ir a una obra</p>
        <ol className="flex flex-wrap gap-1.5">
          {items.map((it, i) => {
            const isCurrent = !done && i === index
            const isScored = it.key in scores
            return (
              <li key={it.key}>
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={isCurrent ? 'true' : undefined}
                  aria-label={`Obra #${it.number}${isScored ? `, puntaje ${scores[it.key]}` : ', sin puntuar'}`}
                  className={cn(
                    'h-8 min-w-9 rounded-full border-2 px-2 text-xs font-bold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue',
                    isScored ? 'border-collage-blue bg-collage-blue/10 text-collage-blue' : 'border-ink/15 text-muted-foreground hover:border-ink/40',
                    isCurrent && 'border-ink bg-ink text-paper',
                  )}
                >
                  {it.number}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>
    </div>
  )
}

function FocusCard({ item, position, total, score, comment, saving, onScore, onComment, onSaveComment, onPrev, onNext }: {
  item: FocusItem
  position: number
  total: number
  score: number | undefined
  comment: string
  saving: boolean
  onScore: (value: number) => void
  onComment: (value: string) => void
  onSaveComment: () => void
  onPrev?: () => void
  onNext?: () => void
}) {
  const navButton = 'inline-flex size-11 items-center justify-center rounded-full border-2 border-ink/15 text-ink hover:border-ink/40 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue'
  return (
    <article className="mt-4 overflow-hidden rounded-2xl border-2 border-ink/10 bg-card" aria-label={`Obra #${item.number}`}>
      {/* As tall as the screen allows while the score buttons still fit below
          it once scrolled under the sticky progress bar. */}
      <div className="relative h-[clamp(16rem,calc(100svh-23rem),56rem)] bg-paper sm:h-[clamp(16rem,calc(100svh-19rem),56rem)]">
        <Image src={item.imageUrl} alt={item.title?.trim() || `Obra #${item.number}`} fill priority sizes="(max-width: 768px) 100vw, 720px" className="object-contain p-3" />
      </div>
      <div className="space-y-4 p-5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onPrev} disabled={!onPrev} className={navButton} aria-label="Obra anterior"><ChevronLeft className="size-5" aria-hidden /></button>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">
              <span className="mr-2 text-muted-foreground">#{item.number}</span>
              {item.title?.trim() || 'Sin título'}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{position} de {total}</span>
              {item.technique && <span className="rounded-full bg-ink/5 px-2.5 py-0.5 font-semibold text-ink">{item.technique}</span>}
              <a href={item.imageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-ink">
                Ver en tamaño completo<ExternalLink className="size-3" aria-hidden />
              </a>
            </p>
          </div>
          <button type="button" onClick={onNext} disabled={!onNext} className={navButton} aria-label="Obra siguiente"><ChevronRight className="size-5" aria-hidden /></button>
        </div>

        <fieldset aria-busy={saving}>
          <legend className="mb-2 text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">Puntaje</legend>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
            {SCORES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onScore(n)}
                disabled={closed}
                aria-pressed={score === n}
                className={cn(
                  'flex h-14 items-center justify-center rounded-xl border-2 text-lg font-bold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue',
                  score === n ? 'border-collage-blue bg-collage-blue text-primary-foreground' : 'border-ink/15 text-ink hover:border-ink/40',
                  closed && 'cursor-not-allowed opacity-60',
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="mt-2 hidden text-xs text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:block">
            Teclado: <Kbd>1</Kbd>–<Kbd>9</Kbd> puntúan, <Kbd>0</Kbd> es 10, <Kbd>←</Kbd> <Kbd>→</Kbd> para moverte.
          </p>
        </fieldset>

        <label className="block text-sm">
          <span className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">Comentario (opcional)</span>
          <textarea value={comment} onChange={(event) => onComment(event.target.value)} readOnly={closed} maxLength={1000} rows={2} className="mt-1 w-full rounded-lg border-2 border-ink/15 bg-background px-3 py-2 text-sm" />
        </label>
        <button type="button" onClick={onSaveComment} disabled={closed || saving || score === undefined} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue disabled:opacity-40">
          Guardar comentario
        </button>
        {score === undefined && <p className="text-xs text-muted-foreground">Puntuá la obra para poder guardar un comentario.</p>}
      </div>
    </article>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-ink/20 bg-ink/5 px-1.5 py-0.5 font-sans text-[0.7rem] font-semibold text-ink">{children}</kbd>
}
