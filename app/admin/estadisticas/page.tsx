import { createClient } from '@/lib/supabase/server'
import { AdminPageHeader, StatPill } from '@/components/admin/page-header'
import { StatBar } from '@/components/admin/stat-bar'
import { countryCodeToFlag, countryCodeToName, guessCountryCodeFromName } from '@/lib/participants'

type ArtworkStatsRow = {
  profile_id: string
  technique: string | null
  is_selected: boolean
  profiles: { country_code: string | null; is_public: boolean } | null
}

type LegacyStatsRow = {
  email: string
  country_raw: string | null
  promoted: boolean
  image_url: string | null
}

// Fixed order/colors for the technique breakdown — the same three values the
// onboarding <select> and artwork_technique enum offer (see
// supabase/migrations/20260921040000_artworks.sql), plus a catch-all for
// artworks that never got one (legacy obras never have this field at all;
// a real submission's is nullable too).
const TECHNIQUE_ORDER = ['Analógica', 'Mixta', 'Digital', 'Sin especificar'] as const
const TECHNIQUE_COLORS: Record<string, string> = {
  Analógica: 'var(--collage-blue)',
  Mixta: 'var(--collage-red)',
  Digital: 'var(--collage-yellow)',
  'Sin especificar': 'var(--muted-foreground)',
}
const COUNTRY_BAR_COLOR = 'var(--collage-blue)'
const TOP_COUNTRIES = 10

export default async function EstadisticasPage() {
  const supabase = await createClient()

  // Same universe as /admin/obras: every profile's *curated* artwork
  // (is_selected), regardless of whether it's public yet — a submission
  // counts for these stats the moment it's confirmed, not only once it's
  // announced on the site.
  const { data: artworkData } = await supabase
    .from('artworks')
    .select('profile_id, technique, is_selected, profiles!inner(country_code, is_public)')

  const artworksByProfile = new Map<string, ArtworkStatsRow[]>()
  for (const row of (artworkData ?? []) as unknown as ArtworkStatsRow[]) {
    const list = artworksByProfile.get(row.profile_id) ?? []
    list.push(row)
    artworksByProfile.set(row.profile_id, list)
  }

  const realArtists = [...artworksByProfile.values()]
    .map((rows) => {
      const selected = rows.find((r) => r.is_selected)
      const profile = selected?.profiles
      if (!selected || !profile?.country_code) return null
      return {
        countryCode: profile.country_code,
        technique: selected.technique ?? null,
        artworkCount: rows.length,
        isPublic: profile.is_public,
      }
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)

  // Confirmed pre-registration obras (see supabase/migrations/
  // 20260921070000_legacy_submissions_promoted.sql) — grouped by email since
  // one artist can have sent several candidate photos, only one of which
  // ends up promoted. These have no `technique` on file at all (the
  // spreadsheet backlog never captured it) and no `is_public` toggle (they
  // aren't backed by a `profiles` row yet), so they only feed the país and
  // "varias obras" numbers below, not técnica or estado de publicación.
  const { data: legacyData } = await supabase
    .from('legacy_submissions')
    .select('email, country_raw, promoted, image_url')

  const legacyGroups = new Map<string, LegacyStatsRow[]>()
  for (const row of (legacyData ?? []) as LegacyStatsRow[]) {
    const list = legacyGroups.get(row.email) ?? []
    list.push(row)
    legacyGroups.set(row.email, list)
  }

  const confirmedLegacyArtists = [...legacyGroups.values()]
    .map((rows) => {
      const promotedRow = rows.find((r) => r.promoted && r.image_url)
      if (!promotedRow) return null
      return {
        // Best-effort only, same caveat as app/admin/obras/page.tsx — free-text
        // country_raw doesn't always resolve to a real ISO code.
        countryCode: promotedRow.country_raw ? guessCountryCodeFromName(promotedRow.country_raw) : undefined,
        artworkCount: rows.length,
      }
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)

  const totalArtists = realArtists.length + confirmedLegacyArtists.length
  const multiObraCount =
    realArtists.filter((a) => a.artworkCount > 1).length +
    confirmedLegacyArtists.filter((a) => a.artworkCount > 1).length

  const countryCounts = new Map<string, number>()
  let noCountryCount = 0
  for (const artist of realArtists) {
    countryCounts.set(artist.countryCode, (countryCounts.get(artist.countryCode) ?? 0) + 1)
  }
  for (const artist of confirmedLegacyArtists) {
    if (artist.countryCode) {
      countryCounts.set(artist.countryCode, (countryCounts.get(artist.countryCode) ?? 0) + 1)
    } else {
      noCountryCount += 1
    }
  }

  const sortedCountries = [...countryCounts.entries()].sort((a, b) => b[1] - a[1])
  const otherCountriesCount = sortedCountries.slice(TOP_COUNTRIES).reduce((sum, [, count]) => sum + count, 0)
  const countryRows = [
    ...sortedCountries.slice(0, TOP_COUNTRIES).map(([code, count]) => ({
      key: code,
      label: `${countryCodeToFlag(code)} ${countryCodeToName(code)}`,
      count,
    })),
    ...(otherCountriesCount > 0 ? [{ key: 'otros', label: 'Otros países', count: otherCountriesCount }] : []),
    ...(noCountryCount > 0 ? [{ key: 'sin-pais', label: 'Sin país registrado', count: noCountryCount }] : []),
  ]
  const maxCountryCount = Math.max(...countryRows.map((r) => r.count), 1)

  const techniqueCounts = new Map<string, number>()
  for (const artist of realArtists) {
    const key = artist.technique ?? 'Sin especificar'
    techniqueCounts.set(key, (techniqueCounts.get(key) ?? 0) + 1)
  }
  techniqueCounts.set('Sin especificar', (techniqueCounts.get('Sin especificar') ?? 0) + confirmedLegacyArtists.length)
  const techniqueRows = TECHNIQUE_ORDER.map((key) => ({ key, count: techniqueCounts.get(key) ?? 0 })).filter(
    (row) => row.count > 0,
  )
  const maxTechniqueCount = Math.max(...techniqueRows.map((r) => r.count), 1)
  const distinctTechniqueCount = techniqueRows.filter((r) => r.key !== 'Sin especificar').length

  // Publicación solo aplica a artistas registrados en el sitio — las obras
  // precargadas se confirman por otro camino (ver comentario más arriba) y
  // nunca pasan por este toggle.
  const publicCount = realArtists.filter((a) => a.isPublic).length
  const pendingCount = realArtists.length - publicCount

  return (
    <div>
      <AdminPageHeader eyebrow="Convocatoria" title="Estadísticas" />

      <div className="mt-6 flex flex-wrap gap-3">
        <StatPill label="Artistas confirmados" value={totalArtists} />
        <StatPill label="Países representados" value={countryCounts.size} />
        <StatPill label="Técnicas distintas" value={distinctTechniqueCount} />
        <StatPill label="Con varias obras" value={multiObraCount} />
      </div>

      {totalArtists === 0 ? (
        <p className="mt-14 rounded-2xl border-2 border-ink/10 bg-card px-4 py-10 text-center text-muted-foreground">
          Todavía no hay obras confirmadas para analizar.
        </p>
      ) : (
        <div className="mt-12 grid gap-12 lg:grid-cols-2">
          <section>
            <h2 className="font-display text-xl tracking-tight text-ink uppercase">Por país</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Top {Math.min(TOP_COUNTRIES, sortedCountries.length)} de {countryCounts.size} países representados.
            </p>
            <div className="mt-5 space-y-3">
              {countryRows.map((row) => (
                <StatBar
                  key={row.key}
                  label={row.label}
                  value={row.count}
                  maxValue={maxCountryCount}
                  total={totalArtists}
                  color={COUNTRY_BAR_COLOR}
                />
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-display text-xl tracking-tight text-ink uppercase">Por técnica</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Declarada al inscribirse — las obras precargadas no tienen este dato.
            </p>
            <div className="mt-5 space-y-3">
              {techniqueRows.map((row) => (
                <StatBar
                  key={row.key}
                  label={row.key}
                  value={row.count}
                  maxValue={maxTechniqueCount}
                  total={totalArtists}
                  color={TECHNIQUE_COLORS[row.key]}
                />
              ))}
            </div>
          </section>

          {realArtists.length > 0 && (
            <section>
              <h2 className="font-display text-xl tracking-tight text-ink uppercase">Estado de publicación</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                De los {realArtists.length} artistas registrados en el sitio (no incluye obras precargadas).
              </p>
              <div className="mt-5 space-y-3">
                <StatBar
                  label="Publicadas"
                  value={publicCount}
                  maxValue={realArtists.length}
                  total={realArtists.length}
                  color="var(--collage-blue)"
                />
                <StatBar
                  label="Pendientes"
                  value={pendingCount}
                  maxValue={realArtists.length}
                  total={realArtists.length}
                  color="var(--muted-foreground)"
                />
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
