'use client'

import { useState } from 'react'
import Image from 'next/image'
import { CheckCircle2, Star } from 'lucide-react'
import { SubmitButton } from '@/components/admin/submit-button'
import { useI18n } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/format'
import { cn } from '@/lib/utils'

export type PickerArtwork = {
  id: string
  title: string | null
  imageUrl: string
  isSelected: boolean
  isEntered: boolean
}

// Free artists pick one obra (a radio: it is both postulated and main).
// Artists who paid tick up to `limit` obras and mark which one is main.
// The server re-validates everything (resolveEntryChoice), this only keeps
// the form from offering more than the limit.
export function EntryPicker({
  artworks,
  limit,
  preselectId,
  action,
}: {
  artworks: PickerArtwork[]
  limit: number
  // A just-uploaded obra, offered as the choice so the artist only confirms.
  preselectId?: string
  action: (formData: FormData) => void | Promise<void>
}) {
  const { m } = useI18n()
  const multi = limit > 1
  const current = artworks.find((artwork) => artwork.isSelected)?.id ?? artworks[0]?.id

  const initialEntered = () => {
    const entered = artworks.filter((artwork) => artwork.isEntered).map((artwork) => artwork.id)
    if (!multi) return [preselectId ?? current].filter(Boolean) as string[]
    if (preselectId && !entered.includes(preselectId) && entered.length < limit) entered.push(preselectId)
    return entered.length > 0 ? entered.slice(0, limit) : [current].filter(Boolean) as string[]
  }
  const [entered, setEntered] = useState<string[]>(initialEntered)
  const [main, setMain] = useState<string | undefined>(() =>
    multi && current && entered.includes(current) ? current : entered[0],
  )

  function toggle(id: string) {
    if (!multi) {
      setEntered([id])
      setMain(id)
      return
    }
    const next = entered.includes(id) ? entered.filter((other) => other !== id) : [...entered, id]
    setEntered(next)
    if (!next.includes(main ?? '')) setMain(next[0])
  }

  const full = entered.length >= limit

  return (
    <form action={action} className="mt-8 space-y-5">
      {multi && (
        <p className="text-center text-sm font-semibold text-collage-blue" aria-live="polite">
          {fmt(m.entries.selectedCount, { selected: entered.length, limit })}
        </p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {artworks.map((artwork) => {
          const isEntered = entered.includes(artwork.id)
          const disabled = multi && !isEntered && full
          const title = artwork.title?.trim() || m.common.noData
          return (
            <li key={artwork.id}>
              <label
                className={cn(
                  'block cursor-pointer overflow-hidden rounded-2xl border-2 bg-card transition-colors',
                  isEntered ? 'border-collage-blue shadow-sm' : 'border-ink/10 hover:border-ink/30',
                  disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                <div className="relative aspect-[4/3] bg-paper">
                  <Image src={artwork.imageUrl} alt={title} fill sizes="(max-width: 640px) 100vw, 320px" className="object-contain p-3" />
                </div>
                <div className="flex items-start gap-3 p-4">
                  <input
                    type={multi ? 'checkbox' : 'radio'}
                    name="entered"
                    value={artwork.id}
                    checked={isEntered}
                    disabled={disabled}
                    onChange={() => toggle(artwork.id)}
                    className="mt-1 size-5 shrink-0 accent-collage-blue"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-semibold text-ink">{title}</p>
                    {isEntered && (
                      <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-collage-blue">
                        <CheckCircle2 className="size-4" aria-hidden="true" />
                        {m.entries.participates}
                      </p>
                    )}
                  </div>
                </div>
              </label>
              {multi && isEntered && (
                <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 px-1 text-sm text-muted-foreground">
                  <input
                    type="radio"
                    name="main"
                    value={artwork.id}
                    checked={main === artwork.id}
                    onChange={() => setMain(artwork.id)}
                    className="size-4 accent-collage-blue"
                  />
                  <Star className="size-4" aria-hidden="true" />
                  {m.entries.main}
                </label>
              )}
            </li>
          )
        })}
      </ul>

      {!multi && <input type="hidden" name="main" value={entered[0] ?? ''} />}
      {multi && <p className="text-center text-xs text-muted-foreground">{m.entries.mainHint}</p>}

      <SubmitButton size="lg" pendingLabel={m.common.saving} disabled={entered.length === 0} className="w-full">
        {m.entries.save}
      </SubmitButton>
    </form>
  )
}
