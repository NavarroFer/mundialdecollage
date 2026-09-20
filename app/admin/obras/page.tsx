import Image from 'next/image'
import { ArrowUp, CircleAlert, CircleCheck, ExternalLink, ImageOff, RefreshCw, Trash2, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AdminPageHeader, StatPill } from '@/components/admin/page-header'
import { SubmissionsGallery } from '@/components/admin/submissions-gallery'
import { SubmitButton } from '@/components/admin/submit-button'
import { LegacyImageSync } from '@/components/admin/legacy-image-sync'
import { LegacyImageUpload } from '@/components/admin/legacy-image-upload'
import { NameCleanup, type NameCleanupItem } from '@/components/admin/name-cleanup'
import { normalizeArtistName } from '@/lib/name-format'
import {
  deleteArtwork,
  deleteLegacySubmission,
  importLegacySubmissions,
  promoteLegacySubmission,
  retryLegacyImageFetch,
  selectArtwork,
  selectLegacySubmission,
} from './actions'

type ArtworkRow = {
  id: string
  profile_id: string
  slug: string | null
  title: string | null
  image_url: string | null
  technique: string | null
  is_selected: boolean
  profiles: {
    name: string | null
    country_code: string | null
    is_public: boolean
    onboarded_at: string | null
  } | null
}

export default async function ObrasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; imported?: string }>
}) {
  const { error, imported } = await searchParams
  const supabase = await createClient()

  // One row per artwork, grouped by profile below — a profile can now have
  // more than one (see supabase/migrations/20260921040000_artworks.sql),
  // each admin-curated via `is_selected` (selectArtwork/deleteArtwork).
  const { data: artworkData } = await supabase
    .from('artworks')
    .select(
      'id, profile_id, slug, title, image_url, technique, is_selected, profiles!inner(name, country_code, is_public, onboarded_at)',
    )
    .order('created_at', { ascending: true })

  const artworksByProfile = new Map<string, ArtworkRow[]>()
  for (const row of (artworkData ?? []) as unknown as ArtworkRow[]) {
    const list = artworksByProfile.get(row.profile_id) ?? []
    list.push(row)
    artworksByProfile.set(row.profile_id, list)
  }

  const submissions = [...artworksByProfile.entries()]
    .map(([profileId, rows]) => {
      const selected = rows.find((r) => r.is_selected)
      const profile = selected?.profiles
      if (!selected || !profile?.name || !profile.country_code || !selected.title || !selected.image_url) {
        return null
      }
      return {
        id: profileId,
        name: profile.name,
        countryCode: profile.country_code,
        technique: selected.technique ?? undefined,
        artworkTitle: selected.title,
        imageUrl: selected.image_url,
        isPublic: profile.is_public,
        artworkCount: rows.length,
        onboardedAt: profile.onboarded_at ?? '',
      }
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => b.onboardedAt.localeCompare(a.onboardedAt))

  const publicCount = submissions.filter((s) => s.isPublic).length

  // Profiles with more than one artwork row — the ones that actually need
  // an admin's "Usar esta obra" curation (a lone artwork always
  // auto-selects on submission, see app/onboarding/actions.ts).
  const multiArtworkGroups = [...artworksByProfile.entries()].filter(([, rows]) => rows.length > 1)

  // Pre-real-flow submissions that arrived by email (see
  // supabase/migrations/20260919000000_legacy_submissions.sql). Several
  // artists sent more than one obra under the same email, so this is grouped
  // by email below rather than shown as a flat list — an admin picks the one
  // that counts per artist with "Usar esta obra".
  const { data: legacyData } = await supabase
    .from('legacy_submissions')
    .select(
      'id, email, name, drive_url, country_raw, selected, promoted, claimed_by, claimed_at, created_at, image_url, image_fetch_failed_at',
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

  // Split for display, by `promoted` rather than by photo presence — see
  // supabase/migrations/20260921070000_legacy_submissions_promoted.sql.
  // `promoted` is the deliberate second step past `selected` for a
  // multi-candidate artist (a lone obra promotes in the same click as
  // selecting it), so once ANY row in an email's group is promoted, that
  // artist's decision is final: the promoted row moves to the confirmed
  // gallery and its rejected siblings drop out of the pending list entirely
  // instead of lingering there with nothing left to do.
  const promotedRows = legacyRows.filter((r) => r.promoted && r.image_url)
  const unresolvedGroups = new Map<string, typeof legacyRows>()
  for (const [email, rows] of legacyGroups) {
    if (rows.some((r) => r.promoted)) continue
    unresolvedGroups.set(email, rows)
  }
  const unresolvedCount = [...unresolvedGroups.values()].reduce((n, rows) => n + rows.length, 0)

  // "Limpieza de nombres" (ROADMAP.md item 5) — every artist name that would
  // change under normalizeArtistName(), across both real registrations and
  // the legacy backlog. Queried directly against `profiles` rather than
  // reused from artworksByProfile above: a profile can in principle exist
  // without an artwork row yet (e.g. onboarding failed partway through), and
  // its name is still worth cleaning up.
  const { data: allProfiles } = await supabase.from('profiles').select('id, name')
  const nameCleanupItems: NameCleanupItem[] = []
  for (const profile of allProfiles ?? []) {
    if (!profile.name) continue
    const after = normalizeArtistName(profile.name)
    if (after !== profile.name) {
      nameCleanupItems.push({ table: 'profiles', id: profile.id, before: profile.name, after })
    }
  }
  for (const row of legacyRows) {
    if (!row.name) continue
    const after = normalizeArtistName(row.name)
    if (after !== row.name) {
      nameCleanupItems.push({ table: 'legacy_submissions', id: row.id, before: row.name, after })
    }
  }

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

      {nameCleanupItems.length > 0 && (
        <div className="mt-14">
          <AdminPageHeader eyebrow="Curación" title="Limpieza de nombres" />
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Nombres cargados en cualquier combinación de mayúsculas/minúsculas —
            &quot;Registrado&quot; es lo que el artista escribió en /onboarding, &quot;Precargado&quot;
            viene del backlog pegado a mano en el import de abajo.
          </p>
          <div className="mt-6">
            <NameCleanup items={nameCleanupItems} />
          </div>
        </div>
      )}

      {multiArtworkGroups.length > 0 && (
        <div className="mt-14">
          <AdminPageHeader eyebrow="Curación" title="Artistas con varias obras" />
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Mandaron más de una obra — elegí cuál es la que cuenta con &quot;Usar esta
            obra&quot;. La grilla de arriba solo muestra la elegida de cada uno.
          </p>

          <div className="mt-6 space-y-4">
            {multiArtworkGroups.map(([profileId, rows]) => {
              const displayName = rows.find((r) => r.profiles?.name)?.profiles?.name ?? 'Sin nombre'
              return (
                <div key={profileId} className="rounded-2xl border-2 border-ink/10 bg-card p-5">
                  <p className="font-semibold text-ink">{displayName}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {rows.map((row) => (
                      <div key={row.id} className="text-left">
                        <div className="relative aspect-square overflow-hidden rounded-xl border-2 border-ink/10 bg-muted">
                          {row.image_url && (
                            <Image
                              src={row.image_url}
                              alt={row.title ?? displayName}
                              fill
                              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                              className="object-cover"
                            />
                          )}
                          {row.is_selected && (
                            <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-collage-blue px-2 py-0.5 text-[0.65rem] font-bold text-primary-foreground">
                              <CircleCheck className="h-3 w-3" />
                              Elegida
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 truncate text-sm font-semibold text-ink">
                          {row.title ?? 'Sin título'}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <form action={selectArtwork}>
                            <input type="hidden" name="id" value={row.id} />
                            <SubmitButton
                              size="sm"
                              variant={row.is_selected ? 'primary' : 'outline'}
                              className="h-auto gap-1 px-2 py-1 text-[0.65rem]"
                              pendingLabel="Guardando…"
                            >
                              {row.is_selected ? 'Elegida' : 'Usar esta obra'}
                            </SubmitButton>
                          </form>
                          <form action={deleteArtwork}>
                            <input type="hidden" name="id" value={row.id} />
                            <SubmitButton
                              size="sm"
                              variant="ghost"
                              className="h-auto gap-1 px-1.5 py-1 text-[0.65rem] text-collage-red hover:bg-collage-red/10"
                              pendingLabel="Borrando…"
                            >
                              <Trash2 className="h-3 w-3" />
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
      )}

      <div className="mt-14">
        <AdminPageHeader eyebrow="Antes del sitio" title="Obras precargadas" />
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Obras que llegaron por mail antes de que existiera el registro con Google. Al
          importarlas acá, cuando esa persona se registre en el sitio ya va a encontrar sus
          datos cargados en el formulario de inscripción — pero solo la obra que marques como
          &quot;Usar esta obra&quot; si mandó más de una. Si mandó una sola, queda confirmada
          en el mismo click; si mandó varias, después de elegir hace falta un segundo click en
          &quot;Subir&quot; para confirmarla.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <StatPill label="Precargadas" value={legacyRows.length} />
          <StatPill label="Artistas" value={legacyGroups.size} />
          <StatPill label="Con varias obras" value={multiSubmissionCount} />
          <StatPill label="Elegidas" value={selectedCount} />
          <StatPill label="Confirmadas" value={promotedRows.length} />
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

        {promotedRows.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-ink">Obras confirmadas ({promotedRows.length})</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {promotedRows.map((row) => (
                <div key={row.id} className="text-left">
                  <div className="relative aspect-square overflow-hidden rounded-xl border-2 border-ink/10 bg-muted">
                    <Image
                      src={row.image_url as string}
                      alt={row.name ?? row.email}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                      className="object-cover"
                    />
                    <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-collage-blue px-2 py-0.5 text-[0.65rem] font-bold text-primary-foreground">
                      <CircleCheck className="h-3 w-3" />
                      Confirmada
                    </span>
                  </div>
                  <p className="mt-1.5 truncate text-sm font-semibold text-ink">
                    {row.name ?? 'Sin nombre'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                  <div className="mt-1.5">
                    <form action={deleteLegacySubmission}>
                      <input type="hidden" name="id" value={row.id} />
                      <SubmitButton
                        size="sm"
                        variant="ghost"
                        className="h-auto gap-1 px-1.5 py-1 text-[0.65rem] text-collage-red hover:bg-collage-red/10"
                        pendingLabel="Borrando…"
                      >
                        <Trash2 className="h-3 w-3" />
                      </SubmitButton>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 space-y-4">
          {legacyGroups.size === 0 && (
            <p className="rounded-2xl border-2 border-ink/10 bg-card px-4 py-8 text-center text-muted-foreground">
              Todavía no importaste ninguna obra precargada.
            </p>
          )}
          {unresolvedGroups.size > 0 && (
            <h3 className="text-sm font-semibold text-ink">Curación pendiente ({unresolvedCount})</h3>
          )}
          {[...unresolvedGroups.entries()].map(([email, rows]) => {
            const displayName = rows.find((r) => r.name)?.name ?? null
            const selectedRow = rows.find((r) => r.selected)
            return (
              <div key={email} className="rounded-2xl border-2 border-ink/10 bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{email}</p>
                    <p className="text-sm text-muted-foreground">{displayName ?? 'Sin nombre'}</p>
                  </div>
                  {rows.length > 1 && (
                    <span className="rounded-full bg-collage-red/10 px-2.5 py-1 text-xs font-semibold text-collage-red">
                      {rows.length} obras — {selectedRow ? 'elegida, falta subir' : 'falta elegir'}
                    </span>
                  )}
                </div>

                <div className="mt-3 divide-y divide-ink/10">
                  {rows.map((row) => (
                    <div
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {row.image_url && (
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-ink/10 bg-muted">
                            <Image
                              src={row.image_url}
                              alt={row.name ?? row.email}
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          </div>
                        )}
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
                          {!row.image_url && <LegacyImageUpload id={row.id} />}
                        </div>
                        {row.claimed_by && (
                          <span className="ml-2 rounded-full bg-collage-blue/15 px-2 py-0.5 text-[0.65rem] font-semibold text-collage-blue">
                            Reclamada
                          </span>
                        )}
                        </div>
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
                        {row.selected && !row.promoted && (
                          <form action={promoteLegacySubmission}>
                            <input type="hidden" name="id" value={row.id} />
                            <SubmitButton size="sm" variant="primary" className="gap-1.5" pendingLabel="Subiendo…">
                              <ArrowUp className="h-3.5 w-3.5" />
                              Subir
                            </SubmitButton>
                          </form>
                        )}
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
