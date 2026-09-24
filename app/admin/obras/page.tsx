import Image from 'next/image'
import { CircleAlert, CircleCheck, ExternalLink, RefreshCw, Trash2, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { guessCountryCodeFromName } from '@/lib/participants'
import { AdminPageHeader, StatPill } from '@/components/admin/page-header'
import { SubmissionsGallery } from '@/components/admin/submissions-gallery'
import { SubmitButton } from '@/components/admin/submit-button'
import { LegacyImageSync } from '@/components/admin/legacy-image-sync'
import { LegacyImageUpload } from '@/components/admin/legacy-image-upload'
import { NameCleanup, type NameCleanupItem } from '@/components/admin/name-cleanup'
import { normalizeArtistName } from '@/lib/name-format'
import { instagramUrl } from '@/lib/instagram'
import {
  deleteArtwork,
  deleteLegacySubmission,
  importLegacySubmissions,
  retryLegacyImageFetch,
  selectArtwork,
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
    instagram: string | null
  } | null
}

export default async function ObrasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; imported?: string }>
}) {
  const { error, imported } = await searchParams
  const supabase = await createClient()
  const { data: receivedCount } = await supabase.rpc('get_total_submissions_count')

  // One row per artwork, grouped by profile below — a profile can now have
  // more than one (see supabase/migrations/20260921040000_artworks.sql),
  // each admin-curated via `is_selected` (selectArtwork/deleteArtwork).
  const { data: artworkData } = await supabase
    .from('artworks')
    .select(
      'id, profile_id, slug, title, image_url, technique, is_selected, profiles!inner(name, country_code, is_public, onboarded_at, instagram)',
    )
    .is('archived_at', null)
    .order('created_at', { ascending: true })

  const artworksByProfile = new Map<string, ArtworkRow[]>()
  for (const row of (artworkData ?? []) as unknown as ArtworkRow[]) {
    const list = artworksByProfile.get(row.profile_id) ?? []
    list.push(row)
    artworksByProfile.set(row.profile_id, list)
  }

  const realSubmissions = [...artworksByProfile.entries()]
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
        source: 'real' as const,
        onboardedAt: profile.onboarded_at ?? '',
        artworkId: selected.id,
        instagram: profile.instagram ?? undefined,
        siblings:
          rows.length > 1
            ? rows.map((r) => ({ id: r.id, title: r.title, imageUrl: r.image_url, isSelected: r.is_selected }))
            : undefined,
      }
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => b.onboardedAt.localeCompare(a.onboardedAt))

  // Profiles with more than one artwork row — the ones that actually need
  // an admin's "Usar esta obra" curation (a lone artwork always
  // auto-selects on submission, see app/onboarding/actions.ts).
  const multiArtworkGroups = [...artworksByProfile.entries()].filter(([, rows]) => rows.length > 1)

  // Pre-real-flow submissions that arrived by email (see
  // supabase/migrations/20260919000000_legacy_submissions.sql). Several
  // artists sent more than one obra under the same email, so this is grouped
  // by email below; one per artist is confirmed automatically and an admin
  // can switch it from the gallery viewer.
  const { data: legacyData } = await supabase
    .from('legacy_submissions')
    .select(
      'id, email, name, drive_url, country_raw, selected, promoted, claimed_by, claimed_at, created_at, image_url, image_fetch_failed_at, instagram',
    )
    .is('archived_at', null)
    .order('email', { ascending: true })
    .order('created_at', { ascending: true })

  const legacyRows = legacyData ?? []
  const legacyGroups = new Map<string, typeof legacyRows>()
  for (const row of legacyRows) {
    const list = legacyGroups.get(row.email) ?? []
    list.push(row)
    legacyGroups.set(row.email, list)
  }
  const multiSubmissionCount = [...legacyGroups.values()].filter((rows) => rows.length > 1).length
  const imagesPendingCount = legacyRows.filter(
    (r) => r.drive_url && !r.image_url && !r.image_fetch_failed_at,
  ).length
  const imagesFailedCount = legacyRows.filter((r) => r.image_fetch_failed_at).length
  // Never has an image and never will without admin action — a promoted row
  // in this state is invisible everywhere else (it fails the `image_url`
  // check in promotedRows below), so this is the only place it still
  // surfaces. Surfaced at the very top of the page (see the JSX below)
  // instead of buried in whichever curation list it came from.
  const missingImageRows = legacyRows.filter((r) => r.image_fetch_failed_at && !r.image_url)

  const promotedRows = legacyRows.filter((r) => r.promoted && r.image_url)

  // Rows already linked to a real profile — self-claimed via /onboarding, or
  // previously published from here (see provisionLegacyProfiles in
  // ./actions.ts) — so the gallery/viewer can show their real
  // "Participa"/"Ocultar" state instead of always looking unpublished.
  const claimedProfileIds = [
    ...new Set(promotedRows.map((r) => r.claimed_by).filter((id): id is string => Boolean(id))),
  ]
  const { data: claimedProfiles } =
    claimedProfileIds.length > 0
      ? await supabase.from('profiles').select('id, is_public').in('id', claimedProfileIds)
      : { data: [] as { id: string; is_public: boolean }[] }
  const claimedPublicById = new Map((claimedProfiles ?? []).map((p) => [p.id, p.is_public]))

  // The "Obras" gallery up top used to only ever show real registrations —
  // a confirmed legacy submission had nowhere to live but its own separate
  // grid further down the page, so an admin had to check two different
  // spots to see everything that's actually been received and decided.
  // Folding promotedRows in here (still no real `profiles` row behind them —
  // see SubmissionsGallery's `source: 'legacy'` handling for what that
  // rules out) gives one unified view. Every email group has a promoted row
  // (supabase/migrations/20260923120000_auto_promote_legacy_submissions.sql),
  // so nothing needs a separate curation list anymore.
  // A claimed row already has its own `source: 'real'` card above (via
  // artworksByProfile) once that publish/self-onboarding actually went
  // through — showing it again here would duplicate the same obra. Only
  // dropped when the real counterpart actually made it into realSubmissions
  // (name/country/title/image all present); otherwise this stays the only
  // visible copy instead of the obra silently disappearing from both lists.
  const realProfileIds = new Set(realSubmissions.map((s) => s.id))

  const legacyGalleryItems = promotedRows
    .filter((row) => !(row.claimed_by && realProfileIds.has(row.claimed_by)))
    .map((row) => {
      const groupRows = legacyGroups.get(row.email) ?? [row]
      return {
        id: `legacy-${row.id}`,
        name: row.name ?? 'Sin nombre',
        // Best-effort only — country_raw is hand-salvaged free text, not a real
        // ISO code (see guessCountryCodeFromName's comment), so this is left
        // undefined rather than shown/filtered wrong when it doesn't match.
        // The viewer also uses this to decide whether "Estas participan" can
        // publish straight away or needs a country picked by hand first.
        countryCode: row.country_raw ? guessCountryCodeFromName(row.country_raw) : undefined,
        imageUrl: row.image_url as string,
        driveUrl: row.drive_url ?? undefined,
        isPublic: row.claimed_by ? (claimedPublicById.get(row.claimed_by) ?? false) : false,
        source: 'legacy' as const,
        legacyId: row.id,
        email: row.email,
        imageFetchFailedAt: row.image_fetch_failed_at,
        instagram: row.instagram ? instagramUrl(row.instagram) : undefined,
        legacySiblings:
          groupRows.length > 1
            ? groupRows.map((r) => ({
                id: r.id,
                name: r.name,
                imageUrl: r.image_url,
                driveUrl: r.drive_url,
                selected: r.selected,
                promoted: r.promoted,
                imageFetchFailedAt: r.image_fetch_failed_at,
              }))
            : undefined,
      }
    })
  const submissions = [...realSubmissions, ...legacyGalleryItems]
  const publicCount = submissions.filter((s) => s.isPublic).length

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

      {missingImageRows.length > 0 && (
        <div className="mt-6 rounded-2xl border-2 border-collage-red/30 bg-collage-red/5 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-collage-red">
            <CircleAlert className="h-4 w-4" />
            Obras precargadas sin foto ({missingImageRows.length})
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            No se pudo traer la foto de Drive — sin foto no aparecen en ninguna galería, ni
            siquiera si ya están confirmadas. Reintentá el link o subí la imagen a mano.
          </p>
          <div className="mt-4 divide-y divide-ink/10">
            {missingImageRows.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {row.name ?? 'Sin nombre'}
                    {row.promoted && (
                      <span className="ml-1.5 rounded-full bg-collage-blue/15 px-2 py-0.5 text-[0.65rem] font-semibold text-collage-blue">
                        Confirmada
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                  {row.drive_url && (
                    <a
                      href={row.drive_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-collage-blue hover:underline"
                    >
                      Ver en Drive <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <form action={retryLegacyImageFetch}>
                    <input type="hidden" name="id" value={row.id} />
                    <SubmitButton size="sm" variant="outline" className="gap-1.5" pendingLabel="Reintentando…">
                      <RefreshCw className="h-3.5 w-3.5" />
                      Reintentar
                    </SubmitButton>
                  </form>
                  <LegacyImageUpload id={row.id} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <StatPill label="Recibidas" value={typeof receivedCount === 'number' ? receivedCount : submissions.length} />
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
          Obras que llegan desde la planilla de Registro (o pegadas acá abajo). Se publican
          solas apenas su foto queda guardada en el sitio. Si alguien mandó varias, participa
          la más reciente; para cambiarla o corregir algo, abrí la obra en la galería de arriba.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <StatPill label="Precargadas" value={legacyRows.length} />
          <StatPill label="Artistas" value={legacyGroups.size} />
          <StatPill label="Con varias obras" value={multiSubmissionCount} />
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
                : error === 'missing_country'
                  ? 'Elegí un país antes de publicar.'
                  : error === 'publish_failed'
                    ? 'No se pudo publicar esa obra — probá de nuevo en un rato.'
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
          <details className="group/confirmed mt-6">
            <summary className="cursor-pointer rounded-lg text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-collage-blue">
              Obras confirmadas ({promotedRows.length})
              <span className="ml-3 text-collage-blue group-open/confirmed:hidden">Mostrar listado</span>
              <span className="ml-3 hidden text-collage-blue group-open/confirmed:inline">Ocultar listado</span>
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">
              Ya se ven arriba, en la galería de &quot;Obras&quot;.
            </p>
            <div className="mt-3 divide-y divide-ink/10 rounded-2xl border-2 border-ink/10 bg-card px-5">
              {promotedRows.map((row) => (
                <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-ink/10 bg-muted">
                      <Image
                        src={row.image_url as string}
                        alt={row.name ?? row.email}
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{row.name ?? 'Sin nombre'}</p>
                      <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                    </div>
                  </div>
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
              ))}
            </div>
          </details>
        )}

        <div className="mt-10 space-y-4">
          {legacyGroups.size === 0 && (
            <p className="rounded-2xl border-2 border-ink/10 bg-card px-4 py-8 text-center text-muted-foreground">
              Todavía no importaste ninguna obra precargada.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
