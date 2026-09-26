'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import {
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  ExternalLink,
  EyeOff,
  ImageOff,
  Instagram,
  Loader2,
  Megaphone,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { countryCodeToFlag } from '@/lib/participants'
import { instagramHandle } from '@/lib/instagram'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/admin/submit-button'
import { LegacyImageUpload } from '@/components/admin/legacy-image-upload'
import { ArtworkEditForm } from '@/components/admin/artwork-edit-form'
import type { ArtworkSibling, LegacySibling, Submission } from '@/components/admin/submission-types'
import {
  deleteArtwork,
  deleteLegacySubmission,
  retryLegacyImageFetch,
  selectArtwork,
  selectLegacySubmission,
  setSubmissionsVisibility,
} from '@/app/admin/obras/actions'

type Props = {
  // The gallery's already-filtered `visible` list, not the full `submissions` —
  // so prev/next respects whatever filter (estado/técnica/país) is currently applied.
  items: Submission[]
  activeIndex: number | null
  onActiveIndexChange: (index: number | null) => void
}

export function ObraViewer({ items, activeIndex, onActiveIndexChange }: Props) {
  const open = activeIndex !== null
  const current = activeIndex !== null ? items[activeIndex] : null
  const [isPending, startTransition] = useTransition()

  // Fed to the JSX below instead of `current` directly — `current` goes null the
  // instant the dialog starts closing, which would blank the content mid fade-out.
  // Adjusted directly during render (React's documented pattern for deriving state
  // from a changing prop — https://react.dev/learn/you-might-not-need-an-effect),
  // not in an effect, so the last real item stays visible through that ~200ms
  // closing transition instead of flashing empty for a frame.
  const [prevCurrent, setPrevCurrent] = useState(current)
  const [renderedItem, setRenderedItem] = useState(current)
  if (current !== prevCurrent) {
    setPrevCurrent(current)
    if (current) setRenderedItem(current)
  }

  const canPrev = activeIndex !== null && activeIndex > 0
  const canNext = activeIndex !== null && activeIndex < items.length - 1

  function goPrev() {
    if (activeIndex !== null && activeIndex > 0) onActiveIndexChange(activeIndex - 1)
  }
  function goNext() {
    if (activeIndex !== null && activeIndex < items.length - 1) onActiveIndexChange(activeIndex + 1)
  }

  // Deleting the active obra revalidates the whole page server-side, which lands
  // 100-300ms later — waiting for that would leave the viewer showing an already-
  // deleted obra, or pointing at a now out-of-range index. Instead this moves on
  // immediately using the index as it stands right now, before that round-trip.
  function handleDeleted() {
    if (activeIndex === null) return
    if (activeIndex < items.length - 1) onActiveIndexChange(activeIndex + 1)
    else if (activeIndex > 0) onActiveIndexChange(activeIndex - 1)
    else onActiveIndexChange(null)
  }

  function toggleVisibility() {
    if (!renderedItem) return
    startTransition(() => {
      setSubmissionsVisibility([renderedItem.id], !renderedItem.isPublic)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onActiveIndexChange(null)
      }}
    >
      <DialogContent
        className="max-h-[90vh] w-[95vw] max-w-4xl overflow-y-auto p-0"
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            goPrev()
          } else if (e.key === 'ArrowRight') {
            e.preventDefault()
            goNext()
          }
        }}
      >
        {renderedItem && (
          <>
            <div className="relative h-[50vh] w-full bg-ink/5 sm:h-[60vh]">
              <Image
                key={renderedItem.id}
                src={renderedItem.imageUrl}
                alt={renderedItem.artworkTitle ? `${renderedItem.artworkTitle}, de ${renderedItem.name}` : renderedItem.name}
                fill
                sizes="90vw"
                className="animate-in fade-in-0 object-contain duration-150 motion-reduce:animate-none"
              />

              <button
                type="button"
                onClick={goPrev}
                disabled={!canPrev}
                aria-label="Obra anterior"
                className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-white/90 p-2 text-ink shadow transition-colors hover:bg-white disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={!canNext}
                aria-label="Obra siguiente"
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-white/90 p-2 text-ink shadow transition-colors hover:bg-white disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6">
              <DialogTitle className="flex flex-wrap items-center gap-1.5 text-lg">
                {renderedItem.countryCode && <span aria-hidden>{countryCodeToFlag(renderedItem.countryCode)}</span>}
                {renderedItem.name}
              </DialogTitle>
              {(renderedItem.artworkTitle || renderedItem.technique) && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {renderedItem.artworkTitle}
                  {renderedItem.artworkTitle && renderedItem.technique && ' · '}
                  {renderedItem.technique}
                </p>
              )}
              {renderedItem.instagram && (
                <a
                  href={renderedItem.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold text-collage-red hover:underline"
                >
                  <Instagram className="h-4 w-4" />
                  @{instagramHandle(renderedItem.instagram) ?? renderedItem.instagram}
                </a>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {renderedItem.isPublic ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-collage-blue px-2.5 py-1 text-xs font-bold text-primary-foreground">
                    <Megaphone className="h-3.5 w-3.5" />
                    Participa
                  </span>
                ) : (
                  renderedItem.source === 'legacy' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-bold text-white">
                      <CircleCheck className="h-3.5 w-3.5" />
                      Precargada
                    </span>
                  )
                )}
              </div>

              <div className="mt-5 border-t-2 border-ink/10 pt-5">
                {renderedItem.source === 'legacy' ? (
                  <LegacyActions
                    item={renderedItem}
                    isTogglingVisibility={isPending}
                    onToggleVisibility={toggleVisibility}
                    onDeleted={handleDeleted}
                  />
                ) : (
                  <RealActions
                    item={renderedItem}
                    isTogglingVisibility={isPending}
                    onToggleVisibility={toggleVisibility}
                    onDeleted={handleDeleted}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function RealActions({
  item,
  isTogglingVisibility,
  onToggleVisibility,
  onDeleted,
}: {
  item: Submission
  isTogglingVisibility: boolean
  onToggleVisibility: () => void
  onDeleted: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={isTogglingVisibility} onClick={onToggleVisibility}>
          {isTogglingVisibility ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : item.isPublic ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Megaphone className="h-4 w-4" />
          )}
          {item.isPublic ? 'Ocultar' : 'Estas participan'}
        </Button>

        <form action={deleteArtwork}>
          <input type="hidden" name="id" value={item.artworkId} />
          <SubmitButton
            size="sm"
            variant="ghost"
            className="text-collage-red hover:bg-collage-red/10 hover:text-collage-red"
            pendingLabel="Borrando…"
            onClick={onDeleted}
          >
            <Trash2 className="h-4 w-4" />
            Borrar
          </SubmitButton>
        </form>
      </div>

      {item.artworkId && <ArtworkEditForm key={item.artworkId} item={item} />}

      {item.siblings && item.siblings.length > 0 && (
        <SiblingStrip
          label="Otras obras de este artista — elegí cuál cuenta (las postuladas participan porque pagó por más)"
          siblings={item.siblings}
          fallbackAlt={item.name}
          renderControls={(sibling: ArtworkSibling) => (
            <>
              <form action={selectArtwork}>
                <input type="hidden" name="id" value={sibling.id} />
                <SubmitButton
                  size="sm"
                  variant={sibling.isSelected ? 'primary' : 'outline'}
                  className="h-auto px-1.5 py-0.5 text-[0.6rem]"
                  pendingLabel="…"
                >
                  {sibling.isSelected ? 'Elegida' : 'Usar'}
                </SubmitButton>
              </form>
              {sibling.isEntered && !sibling.isSelected && (
                <span className="text-[0.6rem] font-semibold text-collage-blue">Postulada</span>
              )}
              <form action={deleteArtwork}>
                <input type="hidden" name="id" value={sibling.id} />
                <SubmitButton
                  size="sm"
                  variant="ghost"
                  className="h-auto px-1 py-0.5 text-collage-red hover:bg-collage-red/10"
                  pendingLabel="…"
                >
                  <Trash2 className="h-3 w-3" />
                </SubmitButton>
              </form>
            </>
          )}
          isSelected={(sibling: ArtworkSibling) => sibling.isSelected}
        />
      )}
    </div>
  )
}

function LegacyActions({
  item,
  isTogglingVisibility,
  onToggleVisibility,
  onDeleted,
}: {
  item: Submission
  isTogglingVisibility: boolean
  onToggleVisibility: () => void
  onDeleted: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* setSubmissionsVisibility provisions the account on first publish
            regardless of whether a country was guessed (see its comment in
            ./actions.ts) — same call RealActions' toggle makes for a real
            submission. */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isTogglingVisibility}
          onClick={onToggleVisibility}
        >
          {isTogglingVisibility ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : item.isPublic ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Megaphone className="h-4 w-4" />
          )}
          {item.isPublic ? 'Ocultar' : 'Mostrar en el home'}
        </Button>
      </div>
      {!item.isPublic && (
        <p className="text-xs text-muted-foreground">
          Si esta persona nunca inició sesión, publicarla le crea una cuenta a su nombre —
          si después se loguea de verdad con este mismo mail, entra directo a esa cuenta.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {item.driveUrl && (
          <a
            href={item.driveUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-collage-blue hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            Ver en Drive
          </a>
        )}

        {item.imageFetchFailedAt && (
          <form action={retryLegacyImageFetch}>
            <input type="hidden" name="id" value={item.legacyId} />
            <SubmitButton size="sm" variant="outline" pendingLabel="Reintentando…">
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </SubmitButton>
          </form>
        )}

        {item.legacyId && <LegacyImageUpload id={item.legacyId} />}
      </div>

      <form action={deleteLegacySubmission}>
        <input type="hidden" name="id" value={item.legacyId} />
        <SubmitButton
          size="sm"
          variant="ghost"
          className="text-collage-red hover:bg-collage-red/10 hover:text-collage-red"
          pendingLabel="Borrando…"
          onClick={onDeleted}
        >
          <Trash2 className="h-4 w-4" />
          Borrar
        </SubmitButton>
      </form>

      {item.legacySiblings && item.legacySiblings.length > 0 && (
        <SiblingStrip
          label="Otras obras precargadas de este email — elegí cuál cuenta"
          siblings={item.legacySiblings}
          fallbackAlt={item.name}
          renderControls={(sibling: LegacySibling) => (
            <>
              <form action={selectLegacySubmission}>
                <input type="hidden" name="id" value={sibling.id} />
                <SubmitButton
                  size="sm"
                  variant={sibling.selected ? 'primary' : 'outline'}
                  className="h-auto px-1.5 py-0.5 text-[0.6rem]"
                  pendingLabel="…"
                >
                  {sibling.selected ? 'Elegida' : 'Usar'}
                </SubmitButton>
              </form>
              <form action={deleteLegacySubmission}>
                <input type="hidden" name="id" value={sibling.id} />
                <SubmitButton
                  size="sm"
                  variant="ghost"
                  className="h-auto px-1 py-0.5 text-collage-red hover:bg-collage-red/10"
                  pendingLabel="…"
                >
                  <Trash2 className="h-3 w-3" />
                </SubmitButton>
              </form>
            </>
          )}
          isSelected={(sibling: LegacySibling) => sibling.selected}
        />
      )}
    </div>
  )
}

// Compact thumbnail row shared by RealActions/LegacyActions so every artwork
// from the same artist remains editable directly from the unified gallery.
function SiblingStrip<T extends { id: string; imageUrl: string | null }>({
  label,
  siblings,
  fallbackAlt,
  renderControls,
  isSelected,
}: {
  label: string
  siblings: T[]
  fallbackAlt: string
  renderControls: (sibling: T) => React.ReactNode
  isSelected: (sibling: T) => boolean
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {siblings.map((sibling) => (
          <div key={sibling.id} className="w-20 shrink-0">
            <div className="relative aspect-square overflow-hidden rounded-lg border-2 border-ink/10 bg-muted">
              {sibling.imageUrl ? (
                <Image src={sibling.imageUrl} alt={fallbackAlt} fill sizes="80px" className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <ImageOff className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              {isSelected(sibling) && (
                <span className="absolute bottom-1 left-1 rounded-full bg-collage-blue p-0.5 text-primary-foreground">
                  <CircleCheck className="h-3 w-3" />
                </span>
              )}
            </div>
            <div className={cn('mt-1 flex flex-wrap items-center gap-1')}>{renderControls(sibling)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
