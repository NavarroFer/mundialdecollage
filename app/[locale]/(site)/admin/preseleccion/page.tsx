import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminPageHeader } from '@/components/admin/page-header'
import { adminDescription } from '@/components/admin/admin-sections'
import { imageSrc } from '@/lib/image-src'
import { cn } from '@/lib/utils'
import { loadPreselection, parseOption, parseStage, stageCounts, stageView, type PreselectionSlot } from '@/lib/preselection'
import {
  BATCH_SIZES,
  COLUMN_COUNTS,
  DEFAULT_BATCH_SIZE,
  DEFAULT_COLUMNS,
  DEFAULT_TARGET_PERCENT,
  FINAL_STAGE,
  STAGE_LABELS,
  STAGES,
  TARGET_PERCENTS,
} from '@/lib/preselection-shared'
import { PreselectionBoard, type BoardItem } from './board'
import { tileWidth } from './tile-width'

// The organizers' preselection: every entered obra (one per artist; all of
// those who paid) narrowed down in passes over a mosaic, then sent to the
// jury. Read with the service role (the admin layout already gated this page
// to admins). ?etapa=1|2|3, ?tanda=<obras per batch>, ?fila=<per row>,
// ?meta=<% to keep>, ?vista=elegidas lists what this stage picked so far.
export default async function PreseleccionPage({ searchParams }: {
  searchParams: Promise<{ etapa?: string; tanda?: string; fila?: string; meta?: string; vista?: string }>
}) {
  const params = await searchParams
  const stage = parseStage(params.etapa)
  const batchSize = parseOption(params.tanda, BATCH_SIZES, DEFAULT_BATCH_SIZE)
  const columns = parseOption(params.fila, COLUMN_COUNTS, DEFAULT_COLUMNS)
  const targetPercent = parseOption(params.meta, TARGET_PERCENTS, DEFAULT_TARGET_PERCENT)
  const final = stage === FINAL_STAGE
  const showPicked = !final && params.vista === 'elegidas'

  const { slots, marks } = await loadPreselection(createAdminClient())
  const views = Object.fromEntries(STAGES.map((s) => [s, stageView(slots, marks, s)])) as Record<(typeof STAGES)[number], ReturnType<typeof stageView<PreselectionSlot>>>
  const view = views[stage]
  const counts = stageCounts(view, targetPercent)
  const previousOpen = stage > 1 ? views[(stage - 1) as 1 | 2].open.length : 0

  const onScreen = final ? view.pool : showPicked ? view.pool.filter((slot) => view.picked.has(slot.key)) : view.open.slice(0, batchSize)
  const toItem = (slot: PreselectionSlot): BoardItem => ({
    key: slot.key,
    obraKey: slot.obra.key,
    imageUrl: slot.obra.imageUrl,
    title: slot.obra.title,
    technique: slot.obra.technique,
    artist: slot.artist,
    artistKey: slot.artistKey,
    countryCode: slot.countryCode,
    alternatives: slot.alternatives.map((obra) => ({ key: obra.key, imageUrl: obra.imageUrl, title: obra.title })),
  })
  const width = tileWidth(columns)
  // The batch after this one, so its photos are already loaded.
  const preload = final || showPicked ? [] : view.open.slice(batchSize, batchSize * 2).map((slot) => imageSrc(slot.obra.imageUrl, width))

  const href = (over: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams()
    const values = { etapa: stage, tanda: batchSize, fila: columns, meta: targetPercent, ...over }
    for (const [key, value] of Object.entries(values)) if (value !== undefined) query.set(key, String(value))
    return `/admin/preseleccion?${query}`
  }

  return (
    <div>
      <AdminPageHeader eyebrow="Convocatoria" title="Preselección" description={adminDescription('/admin/preseleccion')} />

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Etapas">
        {STAGES.map((s) => {
          const c = stageCounts(views[s], targetPercent)
          return (
            <Link
              key={s}
              href={href({ etapa: s, vista: undefined })}
              aria-current={s === stage ? 'page' : undefined}
              className={cn('rounded-2xl border-2 px-4 py-2.5 text-sm', s === stage ? 'border-collage-blue bg-collage-blue text-paper' : 'border-ink/10 bg-card text-ink hover:border-ink/25')}
            >
              <span className="font-semibold">{STAGE_LABELS[s]}</span>
              <span className={cn('block text-xs', s === stage ? 'text-paper/85' : 'text-muted-foreground')}>
                {s === FINAL_STAGE ? `${c.picked} de ${c.total} marcadas` : `${c.picked} elegidas · ${c.seen} de ${c.total} vistas`}
              </span>
            </Link>
          )
        })}
      </nav>

      {previousOpen > 0 && (
        <p className="mt-4 rounded-xl border-2 border-collage-yellow/40 bg-collage-yellow/10 px-4 py-3 text-sm text-ink">
          A la {STAGE_LABELS[(stage - 1) as 1 | 2].toLowerCase()} le quedan {previousOpen} obras sin ver. Lo que elijan ahí se suma acá al final.
        </p>
      )}

      {view.pool.length === 0 ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-ink/15 px-4 py-10 text-center text-sm text-muted-foreground">
          {stage === 1 ? 'No hay obras para preseleccionar.' : `Todavía no hay obras elegidas en la ${STAGE_LABELS[(stage - 1) as 1 | 2].toLowerCase()}.`}
        </p>
      ) : (
        <PreselectionBoard
          // A new batch (or stage) starts with fresh state from the server.
          key={`${stage}:${showPicked}:${onScreen.map((slot) => `${slot.key}=${slot.obra.key}`).join(',')}`}
          stage={stage}
          mode={final ? 'final' : showPicked ? 'picked' : 'batch'}
          items={onScreen.map(toItem)}
          initialPicked={onScreen.filter((slot) => view.picked.has(slot.key)).map((slot) => slot.key)}
          counts={counts}
          batchNumber={view.lastBatch + 1}
          batchCount={view.lastBatch + Math.ceil(view.open.length / batchSize)}
          batchSize={batchSize}
          columns={columns}
          targetPercent={targetPercent}
          tileWidth={width}
          preload={preload}
          links={{
            batch: href({ vista: undefined }),
            picked: href({ vista: 'elegidas' }),
            options: Object.fromEntries([
              ...BATCH_SIZES.map((n) => [`tanda-${n}`, href({ tanda: n, vista: showPicked ? 'elegidas' : undefined })]),
              ...COLUMN_COUNTS.map((n) => [`fila-${n}`, href({ fila: n, vista: showPicked ? 'elegidas' : undefined })]),
              ...TARGET_PERCENTS.map((n) => [`meta-${n}`, href({ meta: n, vista: showPicked ? 'elegidas' : undefined })]),
            ]),
          }}
        />
      )}
    </div>
  )
}
