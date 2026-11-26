'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Images, Loader2, Maximize2, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { showNotice } from '@/components/site-notice'
import { imageSrc } from '@/lib/image-src'
import { countryCodeToFlag, countryCodeToName } from '@/lib/participants'
import { cn } from '@/lib/utils'
import { BATCH_SIZES, COLUMN_COUNTS, FINAL_STAGE, repeatedArtists, STAGE_LABELS, TARGET_PERCENTS, type Stage } from '@/lib/preselection-shared'
import { chooseObra, closeBatch, reopenBatch, sendToJury, setPicks } from './actions'

export type BoardItem = {
  key: string
  obraKey: string
  imageUrl: string
  title: string | null
  technique: string | null
  artist: string
  artistKey: string
  countryCode: string | null
  alternatives: { key: string; imageUrl: string; title: string | null }[]
}

type Counts = { total: number; seen: number; remaining: number; pickedSeen: number; picked: number; projected: number | null; target: number }

type Props = {
  stage: Stage
  // batch: one batch of a pass · picked: what this pass picked so far ·
  // final: the final table, every obra at once.
  mode: 'batch' | 'picked' | 'final'
  items: BoardItem[]
  initialPicked: string[]
  counts: Counts
  batchNumber: number
  batchCount: number
  batchSize: number
  columns: number
  targetPercent: number
  tileWidth: number
  preload: string[]
  links: { batch: string; picked: string; options: Record<string, string> }
}

// The final table aims at this many obras for the jury.
const FINAL_RANGE = [50, 60] as const

const percent = (part: number, whole: number) => `${whole > 0 ? Math.round((part / whole) * 100) : 0}%`

export function PreselectionBoard({ stage, mode, items, initialPicked, counts, batchNumber, batchCount, batchSize, columns, targetPercent, tileWidth, preload, links }: Props) {
  const router = useRouter()
  const [picked, setPicked] = useState(() => new Set(initialPicked))
  const [zoomed, setZoomed] = useState<number | null>(null)
  const [swapping, setSwapping] = useState<BoardItem | null>(null)
  const [confirmSend, setConfirmSend] = useState(false)
  const [sent, setSent] = useState<number | null>(null)
  const [busy, startTransition] = useTransition()
  // Picks still on their way to the server: a batch closes only after them.
  const inFlight = useRef(new Set<Promise<void>>())

  useEffect(() => {
    for (const src of preload) new window.Image().src = src
  }, [preload])

  const save = useCallback((keys: string[], value: boolean) => {
    setPicked((prev) => {
      const next = new Set(prev)
      for (const key of keys) if (value) next.add(key); else next.delete(key)
      return next
    })
    const undo = (message: string) => {
      setPicked((prev) => {
        const next = new Set(prev)
        for (const key of keys) if (value) next.delete(key); else next.add(key)
        return next
      })
      showNotice(message)
    }
    const request: Promise<void> = setPicks(stage, keys, value)
      .then((result) => { if (result.error) undo(result.error) })
      .catch(() => undo('No se guardó la marca: revisá la conexión.'))
      .finally(() => { inFlight.current.delete(request) })
    inFlight.current.add(request)
  }, [stage])

  const toggle = useCallback((key: string) => save([key], !picked.has(key)), [picked, save])

  const settle = () => Promise.all([...inFlight.current])

  function run(action: () => Promise<{ error?: string }>, after?: () => void) {
    startTransition(async () => {
      await settle()
      const result = await action().catch(() => ({ error: 'Algo falló: revisá la conexión y probá de nuevo.' }))
      if (result.error) {
        showNotice(result.error)
        return
      }
      after?.()
      router.refresh()
    })
  }

  const nextBatch = () => run(() => closeBatch(stage, items.map((item) => item.key)), () => window.scrollTo({ top: 0 }))
  const previousBatch = () => run(() => reopenBatch(stage), () => window.scrollTo({ top: 0 }))

  function send() {
    startTransition(async () => {
      await settle()
      const result = await sendToJury().catch(() => ({ error: 'Algo falló: revisá la conexión y probá de nuevo.', sent: undefined }))
      setConfirmSend(false)
      if (result.error) {
        showNotice(result.error)
        return
      }
      setSent(result.sent ?? null)
      router.refresh()
    })
  }

  // Live numbers: what the server counted, plus what changed on screen.
  const pickedHere = items.filter((item) => picked.has(item.key)).length
  const pickedTotal = counts.picked - initialPicked.length + pickedHere
  const reference = Math.round((items.length * targetPercent) / 100)
  const seenAfter = counts.seen + (mode === 'batch' ? items.length : 0)
  const pickedSeenAfter = counts.pickedSeen + (mode === 'batch' ? pickedHere : 0)
  const projected = seenAfter > 0 ? Math.round((pickedSeenAfter / seenAfter) * counts.total) : null
  const pace = projected === null || counts.target === 0 ? null : projected > counts.target * 1.25 ? 'over' : projected < counts.target * 0.75 ? 'under' : 'ok'

  const repeated = useMemo(() => (mode === 'final' ? repeatedArtists(items, picked) : []), [mode, items, picked])
  const breakdown = useMemo(() => {
    if (mode !== 'final') return null
    const chosen = items.filter((item) => picked.has(item.key))
    const tally = (values: string[]) => [...values.reduce((map, v) => map.set(v, (map.get(v) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])
    return {
      countries: tally(chosen.map((item) => item.countryCode ?? '')),
      techniques: tally(chosen.map((item) => item.technique ?? 'Sin técnica')),
    }
  }, [mode, items, picked])

  const last = mode === 'batch' && counts.remaining <= items.length

  if (mode === 'batch' && items.length === 0) {
    return (
      <section className="mt-8 rounded-2xl border-2 border-collage-blue/30 bg-collage-blue/5 p-6">
        <h2 className="font-display text-2xl text-ink uppercase">Terminaron la {STAGE_LABELS[stage].toLowerCase()}</h2>
        <p className="mt-2 text-ink">
          Eligieron <strong>{counts.picked}</strong> de {counts.total} obras ({Math.round((counts.picked / Math.max(1, counts.total)) * 100)}%).
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild><Link href={`/admin/preseleccion?etapa=${stage + 1}`}>Ir a la {STAGE_LABELS[(stage + 1) as Stage].toLowerCase()} <ArrowRight className="h-4 w-4" /></Link></Button>
          <Button asChild variant="outline"><Link href={links.picked}>Revisar las elegidas</Link></Button>
          <Button variant="outline" onClick={previousBatch} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeft className="h-4 w-4" />} Volver a la última tanda</Button>
        </div>
      </section>
    )
  }

  return (
    <div className="mt-6">
      {mode !== 'final' && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link href={links.batch} aria-current={mode === 'batch' ? 'page' : undefined} className={cn('rounded-full px-3 py-1.5 font-semibold', mode === 'batch' ? 'bg-ink text-paper' : 'bg-ink/5 text-ink hover:bg-ink/10')}>Tandas</Link>
          <Link href={links.picked} aria-current={mode === 'picked' ? 'page' : undefined} className={cn('rounded-full px-3 py-1.5 font-semibold', mode === 'picked' ? 'bg-ink text-paper' : 'bg-ink/5 text-ink hover:bg-ink/10')}>Elegidas ({pickedTotal})</Link>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {mode === 'batch' && <Options label="Obras por tanda" values={BATCH_SIZES} current={batchSize} prefix="tanda" links={links.options} />}
        <Options label="Por fila" values={COLUMN_COUNTS} current={columns} prefix="fila" links={links.options} />
        {mode !== 'final' && <Options label="Meta" values={TARGET_PERCENTS} current={targetPercent} prefix="meta" suffix="%" links={links.options} />}
      </div>

      {/* Counters stay in view while scrolling the mosaic. */}
      <div className="sticky top-0 z-10 -mx-2 mt-4 rounded-2xl border-2 border-ink/10 bg-card/95 px-4 py-3 shadow-sm backdrop-blur" aria-live="polite">
        {mode === 'batch' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Esta tanda · {batchNumber} de {batchCount}
              </p>
              <p className="text-ink">
                <strong className="font-display text-3xl tabular-nums">{pickedHere}</strong>
                <span className="tabular-nums"> de {items.length} elegidas · </span>
                <strong className={cn('tabular-nums', pickedHere > reference * 1.5 && 'text-collage-red')}>{percent(pickedHere, items.length)}</strong>
              </p>
              <p className="text-xs text-muted-foreground">Referencia: {reference} ({targetPercent}%)</p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Total de la {STAGE_LABELS[stage].toLowerCase()}</p>
              <p className="text-ink">
                <strong className="font-display text-3xl tabular-nums">{pickedSeenAfter}</strong>
                <span className="tabular-nums"> de {seenAfter} vistas · </span>
                <strong className={cn('tabular-nums', pace !== 'ok' && pace !== null && 'text-collage-red')}>{percent(pickedSeenAfter, seenAfter)}</strong>
              </p>
              <p className="text-xs text-muted-foreground">
                Quedan <strong className="text-ink tabular-nums">{counts.total - seenAfter}</strong> de {counts.total} por ver
                {projected !== null && <> · a este ritmo terminan en ~{projected} (meta ~{counts.target})</>}
                {pace === 'over' && <strong className="text-collage-red"> · vienen eligiendo de más</strong>}
                {pace === 'under' && <strong className="text-collage-red"> · vienen eligiendo de menos</strong>}
              </p>
            </div>
          </div>
        )}
        {mode === 'picked' && (
          <p className="text-ink">
            <strong className="font-display text-2xl tabular-nums">{pickedTotal}</strong> elegidas de {counts.total} en la {STAGE_LABELS[stage].toLowerCase()} · <strong className="tabular-nums">{percent(pickedTotal, counts.total)}</strong>
            <span className="text-sm text-muted-foreground"> · meta ~{counts.target} · tocá una para sacarla</span>
          </p>
        )}
        {mode === 'final' && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-ink">
              <strong className="font-display text-2xl tabular-nums">{pickedHere}</strong> marcadas de {items.length} · <strong className="tabular-nums">{percent(pickedHere, items.length)}</strong>
              <span className={cn('text-sm', pickedHere >= FINAL_RANGE[0] && pickedHere <= FINAL_RANGE[1] ? 'text-collage-blue' : 'text-muted-foreground')}>
                {' '}· objetivo {FINAL_RANGE[0]}–{FINAL_RANGE[1]}
                {pickedHere > FINAL_RANGE[1] && ` · sobran ${pickedHere - FINAL_RANGE[1]}`}
                {pickedHere < FINAL_RANGE[0] && ` · faltan ${FINAL_RANGE[0] - pickedHere}`}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => save(items.filter((i) => !picked.has(i.key)).map((i) => i.key), true)} disabled={busy || pickedHere === items.length}>Marcar todas</Button>
              <Button size="sm" onClick={() => setConfirmSend(true)} disabled={busy || pickedHere === 0 || repeated.length > 0}><Send className="h-4 w-4" /> Enviar al jurado</Button>
            </div>
          </div>
        )}
      </div>

      {mode === 'final' && (
        <FinalNotes breakdown={breakdown} repeated={repeated} sent={sent} />
      )}

      {confirmSend && (
        <div role="alertdialog" aria-labelledby="send-title" className="mt-4 rounded-2xl border-2 border-collage-red/30 bg-collage-red/5 p-5">
          <h2 id="send-title" className="font-semibold text-ink">¿Enviar {pickedHere} obras al jurado?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Quedan como «Preseleccionada» y los jurados las ven al entrar a /jurado. Cualquier otra obra marcada así en /admin/obras vuelve a «Sin revisar». Se puede volver a enviar si cambian algo.
          </p>
          <div className="mt-4 flex gap-3">
            <Button onClick={send} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Sí, enviar</Button>
            <Button variant="outline" onClick={() => setConfirmSend(false)} disabled={busy}>Cancelar</Button>
          </div>
        </div>
      )}

      <ul className="mt-4 grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }} aria-label="Obras">
        {items.map((item, index) => {
          const on = picked.has(item.key)
          return (
            <li key={item.key} className={cn('group relative overflow-hidden rounded-xl border-4 bg-card transition-colors', on ? 'border-collage-blue' : 'border-transparent ring-1 ring-ink/10')}>
              <button
                type="button"
                onClick={() => toggle(item.key)}
                aria-pressed={on}
                aria-label={`${on ? 'Quitar' : 'Elegir'} ${item.title?.trim() || 'obra sin título'} de ${item.artist}`}
                className="block w-full text-left focus-visible:outline-4 focus-visible:outline-collage-yellow"
              >
                <span className="block aspect-[4/5] bg-paper">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageSrc(item.imageUrl, tileWidth)} alt="" decoding="async" className="h-full w-full object-contain" />
                </span>
                <span className={cn('block px-2 py-1.5', columns >= 6 && 'text-[11px]', columns < 6 && 'text-xs')}>
                  <span className="block truncate font-semibold text-ink">{item.title?.trim() || 'Sin título'}</span>
                  <span className="block truncate text-muted-foreground">
                    {item.countryCode && <span aria-hidden>{countryCodeToFlag(item.countryCode)} </span>}
                    {item.artist}
                    {item.technique && ` · ${item.technique}`}
                  </span>
                </span>
              </button>
              {on && (
                <span className="pointer-events-none absolute top-2 left-2 flex h-8 w-8 items-center justify-center rounded-full bg-collage-blue text-paper shadow" aria-hidden>
                  <Check className="h-5 w-5" strokeWidth={3} />
                </span>
              )}
              <button type="button" onClick={() => setZoomed(index)} aria-label="Ver en grande" className="absolute top-2 right-2 rounded-full bg-ink/70 p-1.5 text-paper opacity-70 hover:opacity-100 focus-visible:opacity-100">
                <Maximize2 className="h-4 w-4" />
              </button>
              {item.alternatives.length > 1 && (
                <button type="button" onClick={() => setSwapping(item)} className="absolute right-2 bottom-14 flex items-center gap-1 rounded-full bg-collage-yellow px-2 py-1 text-[11px] font-semibold text-ink shadow">
                  <Images className="h-3.5 w-3.5" /> {item.alternatives.length} obras
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {mode === 'batch' && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t-2 border-ink/10 pt-5">
          <Button variant="outline" onClick={previousBatch} disabled={busy || batchNumber === 1}>
            <ArrowLeft className="h-4 w-4" /> Tanda anterior
          </Button>
          <p className="text-sm text-muted-foreground">{pickedHere} elegidas de {items.length} en esta tanda</p>
          <Button onClick={nextBatch} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {last ? `Cerrar la ${STAGE_LABELS[stage].toLowerCase()}` : 'Siguiente tanda'} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {zoomed !== null && items[zoomed] && (
        <Lightbox
          item={items[zoomed]}
          position={`${zoomed + 1} de ${items.length}`}
          picked={picked.has(items[zoomed].key)}
          onToggle={() => toggle(items[zoomed].key)}
          onMove={(step) => setZoomed((i) => (i === null ? null : (i + step + items.length) % items.length))}
          onClose={() => setZoomed(null)}
        />
      )}

      {swapping && (
        <SwapDialog
          item={swapping}
          busy={busy}
          onClose={() => setSwapping(null)}
          onChoose={(obraKey) => run(() => chooseObra(swapping.key, obraKey), () => setSwapping(null))}
        />
      )}
    </div>
  )
}

function Options({ label, values, current, prefix, suffix = '', links }: { label: string; values: readonly number[]; current: number; prefix: string; suffix?: string; links: Record<string, string> }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      {values.map((value) => (
        <Link
          key={value}
          href={links[`${prefix}-${value}`]}
          aria-current={value === current ? 'true' : undefined}
          className={cn('min-w-8 rounded-lg px-2 py-1 text-center font-semibold tabular-nums', value === current ? 'bg-collage-blue text-paper' : 'bg-ink/5 text-ink hover:bg-ink/10')}
        >
          {value}{suffix}
        </Link>
      ))}
    </div>
  )
}

function FinalNotes({ breakdown, repeated, sent }: { breakdown: { countries: [string, number][]; techniques: [string, number][] } | null; repeated: BoardItem[][]; sent: number | null }) {
  return (
    <div className="mt-4 space-y-3">
      {sent !== null && (
        <p role="status" className="rounded-xl border-2 border-collage-blue/30 bg-collage-blue/10 px-4 py-3 text-sm text-ink">
          Listo: {sent} obras quedaron preseleccionadas para el jurado. <Link href="/admin/jurado" className="font-semibold underline">Ver en Jurado</Link>
        </p>
      )}
      {repeated.length > 0 && (
        <div role="alert" className="rounded-xl border-2 border-collage-red/30 bg-collage-red/5 px-4 py-3 text-sm text-ink">
          <p className="font-semibold">Hay artistas con más de una obra marcada: dejen una sola de cada uno.</p>
          <ul className="mt-1 list-disc pl-5">
            {repeated.map((group) => <li key={group[0].key}>{group[0].artist}: {group.map((item) => item.title?.trim() || 'Sin título').join(' · ')}</li>)}
          </ul>
        </div>
      )}
      {breakdown && breakdown.countries.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Tally title="Por país" rows={breakdown.countries.map(([code, n]) => [code ? `${countryCodeToFlag(code)} ${countryCodeToName(code)}` : 'Sin país', n])} />
          <Tally title="Por técnica" rows={breakdown.techniques} />
        </div>
      )}
    </div>
  )
}

function Tally({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div className="rounded-xl border-2 border-ink/10 bg-card px-4 py-3">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink">
        {rows.map(([label, n]) => <li key={label}>{label} <strong className="tabular-nums">{n}</strong></li>)}
      </ul>
    </div>
  )
}

function Lightbox({ item, position, picked, onToggle, onMove, onClose }: {
  item: BoardItem
  position: string
  picked: boolean
  onToggle: () => void
  onMove: (step: number) => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowRight') onMove(1)
      else if (event.key === 'ArrowLeft') onMove(-1)
      else if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        onToggle()
      } else return
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onMove, onToggle])

  return (
    <div role="dialog" aria-modal="true" aria-label={item.title?.trim() || 'Obra'} className="fixed inset-0 z-50 flex flex-col bg-ink/95 text-paper">
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
        <p className="min-w-0 truncate">
          <span className="text-paper/60">{position} · </span>
          <strong>{item.title?.trim() || 'Sin título'}</strong> · {item.countryCode && `${countryCodeToFlag(item.countryCode)} `}{item.artist}{item.technique && ` · ${item.technique}`}
        </p>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-full p-2 hover:bg-paper/10"><X className="h-5 w-5" /></button>
      </div>
      <div className="relative min-h-0 flex-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageSrc(item.imageUrl, 1920)} alt="" className="absolute inset-0 h-full w-full object-contain p-2" />
        <button type="button" onClick={() => onMove(-1)} aria-label="Anterior" className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-paper/10 p-3 hover:bg-paper/20"><ArrowLeft className="h-6 w-6" /></button>
        <button type="button" onClick={() => onMove(1)} aria-label="Siguiente" className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-paper/10 p-3 hover:bg-paper/20"><ArrowRight className="h-6 w-6" /></button>
      </div>
      <div className="flex items-center justify-center gap-4 px-4 py-4">
        <button type="button" onClick={onToggle} aria-pressed={picked} className={cn('flex items-center gap-2 rounded-full px-6 py-3 font-semibold', picked ? 'bg-collage-blue text-paper' : 'bg-paper text-ink')}>
          <Check className="h-5 w-5" /> {picked ? 'Elegida' : 'Elegir'}
        </button>
        <p className="hidden text-xs text-paper/60 sm:block">← → para moverse · espacio para elegir · Esc para cerrar</p>
      </div>
    </div>
  )
}

function SwapDialog({ item, busy, onClose, onChoose }: { item: BoardItem; busy: boolean; onClose: () => void; onChoose: (obraKey: string) => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="swap-title" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4" onClick={onClose}>
      <div className="max-h-[90svh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-card p-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="swap-title" className="font-semibold text-ink">{item.artist} mandó {item.alternatives.length} obras y no eligió</h2>
            <p className="text-sm text-muted-foreground">Elijan cuál participa. La marca de esta obra se mantiene.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-full p-2 hover:bg-ink/5"><X className="h-5 w-5" /></button>
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {item.alternatives.map((obra) => {
            const current = obra.key === item.obraKey
            return (
              <li key={obra.key}>
                <button
                  type="button"
                  disabled={busy || current}
                  onClick={() => onChoose(obra.key)}
                  className={cn('block w-full overflow-hidden rounded-xl border-4 text-left', current ? 'border-collage-blue' : 'border-transparent ring-1 ring-ink/10 hover:ring-ink/30')}
                >
                  <span className="block aspect-[4/5] bg-paper">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageSrc(obra.imageUrl, 640)} alt="" className="h-full w-full object-contain" />
                  </span>
                  <span className="block truncate px-2 py-1.5 text-xs font-semibold text-ink">{current ? 'Participa: ' : ''}{obra.title?.trim() || 'Sin título'}</span>
                </button>
              </li>
            )
          })}
        </ul>
        {busy && <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cambiando…</p>}
      </div>
    </div>
  )
}
