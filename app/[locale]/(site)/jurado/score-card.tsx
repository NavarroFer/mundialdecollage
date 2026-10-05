'use client'

import { useActionState, useRef, useState } from 'react'
import Image from 'next/image'
import { Check, Loader2 } from 'lucide-react'
import { saveScore, type ScoreState } from './actions'
import { cn } from '@/lib/utils'

// One obra, blind: the image, its title and técnica, ten score buttons and
// an optional comment. Tapping a score saves it right away (with whatever
// comment is written); «Guardar» is for a comment edited afterwards.
export function ScoreCard({ itemKey, index, imageUrl, title, technique, initialScore, initialComment, closed = false }: {
  itemKey: string
  index: number
  imageUrl: string
  title: string | null
  technique: string | null
  initialScore: number | null
  initialComment: string | null
  closed?: boolean
}) {
  const [state, action, pending] = useActionState<ScoreState, FormData>(saveScore.bind(null, itemKey), { saved: false, error: null })
  const [score, setScore] = useState<number | null>(initialScore)
  // Controlled, so React's reset after each save doesn't wipe what's typed.
  const [comment, setComment] = useState(initialComment ?? '')
  const [zoom, setZoom] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <article id={`obra-${index}`} className="overflow-hidden rounded-2xl border-2 border-ink/10 bg-card">
      <button type="button" onClick={() => setZoom((z) => !z)} className={cn('relative block w-full bg-paper', zoom ? 'aspect-auto h-[80vh]' : 'aspect-[4/3]')} aria-label={zoom ? 'Achicar la obra' : 'Ampliar la obra'}>
        <Image src={imageUrl} alt={title ?? `Obra ${index}`} fill sizes="(max-width: 768px) 100vw, 720px" className="object-contain p-3" />
      </button>
      <form ref={formRef} action={action} className="space-y-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-semibold text-ink">
            <span className="mr-2 text-muted-foreground">#{index}</span>
            {title?.trim() || 'Sin título'}
          </p>
          {technique && <span className="rounded-full bg-ink/5 px-2.5 py-0.5 text-xs font-semibold text-ink">{technique}</span>}
        </div>
        <fieldset>
          <legend className="mb-2 text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">Puntaje</legend>
          <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <label key={n} className={cn(
                'flex h-11 cursor-pointer items-center justify-center rounded-lg border-2 text-sm font-bold transition-colors',
                score === n ? 'border-collage-blue bg-collage-blue text-primary-foreground' : 'border-ink/15 text-ink hover:border-ink/40',
              )}>
                <input type="radio" name="score" value={n} checked={score === n} disabled={closed} onChange={() => { setScore(n); requestAnimationFrame(() => formRef.current?.requestSubmit()) }} className="sr-only" />
                {n}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm">
          <span className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">Comentario (opcional)</span>
          <textarea name="comment" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} rows={2} className="mt-1 w-full rounded-lg border-2 border-ink/15 bg-background px-3 py-2 text-sm" />
        </label>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={closed || pending || score === null} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-paper disabled:opacity-40">
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Guardar
          </button>
          {state.saved && !pending && <span role="status" className="flex items-center gap-1 text-sm font-semibold text-collage-blue"><Check className="size-4" aria-hidden />Guardado</span>}
          {state.error && <span role="alert" className="text-sm text-collage-red">{state.error}</span>}
        </div>
      </form>
    </article>
  )
}
