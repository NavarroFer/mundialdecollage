import { CircleAlert, CircleCheck, ExternalLink, ImageOff, RefreshCw, Trash2, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AdminPageHeader, StatPill } from '@/components/admin/page-header'
import { SubmissionsGallery } from '@/components/admin/submissions-gallery'
import { SubmitButton } from '@/components/admin/submit-button'
import { LegacyImageSync } from '@/components/admin/legacy-image-sync'
import {
  deleteLegacySubmission,
  importLegacySubmissions,
  retryLegacyImageFetch,
  selectLegacySubmission,
} from './actions'

export default async function ObrasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; imported?: string }>
}) {
  const { error, imported } = await searchParams
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, name, country_code, technique, artwork_title, artwork_image_url, is_public, onboarded_at')
    .not('onboarded_at', 'is', null)
    .order('onboarded_at', { ascending: false })

  const submissions = (data ?? [])
    .filter((row) => row.name && row.country_code && row.artwork_title && row.artwork_image_url)
    .map((row) => ({
      id: row.id,
      name: row.name as string,
      countryCode: row.country_code as string,
      technique: row.technique ?? undefined,
      artworkTitle: row.artwork_title as string,
      imageUrl: row.artwork_image_url as string,
      isPublic: row.is_public,
    }))

  const publicCount = submissions.filter((s) => s.isPublic).length

  // Pre-real-flow submissions that arrived by email (see
  // supabase/migrations/20260919000000_legacy_submissions.sql). Several
  // artists sent more than one obra under the same email, so this is grouped
  // by email below rather than shown as a flat list — an admin picks the one
  // that counts per artist with "Usar esta obra".
  const { data: legacyData } = await supabase
    .from('legacy_submissions')
    .select(
      'id, email, name, drive_url, country_raw, selected, claimed_by, claimed_at, created_at, image_url, image_fetch_failed_at',
    )
    .order('email', { ascending: true })
    .order('created_at', { ascending: true })

  const legacyRows = legacyData ?? []
  const legacyGroups = new Map<string, typeof legacyRows>()
  for (const row of legacyRows) {
    const list = legacyGroups.get(row.email) ?? []
    list.push(row)
    legacyGroups.set(row.email, list)
  }
  const selectedCount = legacyRows.filter((r) => r.selected).length
  const multiSubmissionCount = [...legacyGroups.values()].filter((rows) => rows.length > 1).length
  const imagesPendingCount = legacyRows.filter(
    (r) => r.drive_url && !r.image_url && !r.image_fetch_failed_at,
  ).length
  const imagesFailedCount = legacyRows.filter((r) => r.image_fetch_failed_at).length

  return (
    <div>
      <AdminPageHeader eyebrow="Convocatoria" title="Obras" />

      <div className="mt-6 flex flex-wrap gap-3">
        <StatPill label="Recibidas" value={submissions.length} />
        <StatPill label="Publicadas" value={publicCount} />
        <StatPill label="Pendientes" value={submissions.length - publicCount} />
      </div>

      <div className="mt-8">
        <SubmissionsGallery submissions={submissions} />
      </div>

      <div className="mt-14">
        <AdminPageHeader eyebrow="Antes del sitio" title="Obras precargadas" />
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Obras que llegaron por mail antes de que existiera el registro con Google. Al
          importarlas acá, cuando esa persona se registre en el sitio ya va a encontrar sus
          datos cargados en el formulario de inscripción — pero solo la obra que marques como
          &quot;Usar esta obra&quot; si mandó más de una.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <StatPill label="Precargadas" value={legacyRows.length} />
          <StatPill label="Artistas" value={legacyGroups.size} />
          <StatPill label="Con varias obras" value={multiSubmissionCount} />
          <StatPill label="Elegidas" value={selectedCount} />
        </div>

        {imported && (
          <p className="mt-4 rounded-xl border-2 border-collage-blue/30 bg-collage-blue/10 px-4 py-3 text-sm text-ink">
            Se importaron {imported} obras (los duplicados por link de Drive se ignoran).
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-xl border-2 border-collage-red/30 bg-collage-red/10 px-4 py-3 text-sm text-ink">
            {error === 'no_valid_legacy'
              ? 'No encontré ninguna línea válida en el texto pegado.'
              : error === 'retry_failed'
                ? 'Volví a intentar traer esa foto y falló de nuevo — puede que el link de Drive ya no sea público.'
                : error}
          </p>
        )}

        <form
          action={importLegacySubmissions}
          className="mt-6 rounded-2xl border-2 border-ink/10 bg-card p-6"
        >
          <label className="text-sm font-semibold text-ink" htmlFor="legacy_entries">
            Importar obras precargadas
          </label>
          <p className="mt-1 text-sm text-muted-foreground">
            Una por línea, con el formato &quot;Nombre | mail@ejemplo.com | link de Drive | país&quot;
            (el país es opcional, se deja vacío si no se sabe).
          </p>
          <textarea
            id="legacy_entries"
            name="legacy_entries"
            required
            rows={8}
            className="mt-3 w-full rounded-xl border-2 border-ink/15 bg-background p-3 font-mono text-sm text-ink"
            placeholder={
              'Sofía Ramírez | sofia@ejemplo.com | https://drive.google.com/file/d/XXXX/view | Argentina'
            }
          />
          <SubmitButton className="mt-4 gap-2" pendingLabel="Importando…">
            <Upload className="h-4 w-4" />
            Importar
          </SubmitButton>
        </form>

        {legacyRows.length > 0 && (
          <LegacyImageSync initialPending={imagesPendingCount} initialFailed={imagesFailedCount} />
        )}

        <div className="mt-6 space-y-4">
          {legacyGroups.size === 0 && (
            <p className="rounded-2xl border-2 border-ink/10 bg-card px-4 py-8 text-center text-muted-foreground">
              Todavía no importaste ninguna obra precargada.
            </p>
          )}
          {[...legacyGroups.entries()].map(([email, rows]) => {
            const displayName = rows.find((r) => r.name)?.name ?? null
            return (
              <div key={email} className="rounded-2xl border-2 border-ink/10 bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{email}</p>
                    <p className="text-sm text-muted-foreground">{displayName ?? 'Sin nombre'}</p>
                  </div>
                  {rows.length > 1 && (
                    <span className="rounded-full bg-collage-red/10 px-2.5 py-1 text-xs font-semibold text-collage-red">
                      {rows.length} obras — {rows.some((r) => r.selected) ? 'elegida' : 'falta elegir'}
                    </span>
                  )}
                </div>

                <div className="mt-3 divide-y divide-ink/10">
                  {rows.map((row) => (
                    <div
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-ink">
                          {row.name ?? 'Sin nombre'}
                          {row.country_raw && (
                            <span className="ml-1.5 font-normal text-muted-foreground">
                              · {row.country_raw}
                            </span>
                          )}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          {row.drive_url ? (
                            <a
                              href={row.drive_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-collage-blue hover:underline"
                            >
                              Ver en Drive <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sin link</span>
                          )}
                          {row.image_url ? (
                            <span className="inline-flex items-center gap-1 text-[0.65rem] font-semibold text-collage-blue">
                              <CircleCheck className="h-3 w-3" />
                              Foto guardada en el sitio
                            </span>
                          ) : row.image_fetch_failed_at ? (
                            <span className="inline-flex items-center gap-1.5 text-[0.65rem] font-semibold text-collage-red">
                              <CircleAlert className="h-3 w-3" />
                              No se pudo traer
                              <form action={retryLegacyImageFetch}>
                                <input type="hidden" name="id" value={row.id} />
                                <SubmitButton
                                  size="sm"
                                  variant="ghost"
                                  className="h-auto gap-1 px-1.5 py-0.5 text-[0.65rem] text-collage-red hover:bg-collage-red/10"
                                  pendingLabel="Reintentando…"
                                >
                                  <RefreshCw className="h-3 w-3" />
                                  Reintentar
                                </SubmitButton>
                              </form>
                            </span>
                          ) : row.drive_url ? (
                            <span className="inline-flex items-center gap-1 text-[0.65rem] font-semibold text-muted-foreground">
                              <ImageOff className="h-3 w-3" />
                              Todavía en Drive
                            </span>
                          ) : null}
                        </div>
                        {row.claimed_by && (
                          <span className="ml-2 rounded-full bg-collage-blue/15 px-2 py-0.5 text-[0.65rem] font-semibold text-collage-blue">
                            Reclamada
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <form action={selectLegacySubmission}>
                          <input type="hidden" name="id" value={row.id} />
                          <SubmitButton
                            size="sm"
                            variant={row.selected ? 'primary' : 'outline'}
                            className="gap-1.5"
                            pendingLabel="Guardando…"
                          >
                            {row.selected ? (
                              <>
                                <CircleCheck className="h-3.5 w-3.5" />
                                Elegida
                              </>
                            ) : (
                              'Usar esta obra'
                            )}
                          </SubmitButton>
                        </form>
                        <form action={deleteLegacySubmission}>
                          <input type="hidden" name="id" value={row.id} />
                          <SubmitButton
                            size="sm"
                            variant="ghost"
                            className="gap-1.5 text-collage-red hover:bg-collage-red/10 hover:text-collage-red"
                            pendingLabel="Borrando…"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Borrar
                          </SubmitButton>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
